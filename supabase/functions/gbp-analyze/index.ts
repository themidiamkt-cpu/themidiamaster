const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Point = { lat: number; lng: number; x?: number; y?: number };
const defaultGoogleMapsApiKey = 'AIzaSyAyH7teIp1Xjprln7TaA1i_dIY8TB0_HgE';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const payload = await req.json();
    const apiKey = payload.apiKey || Deno.env.get('GOOGLE_MAPS_API_KEY') || defaultGoogleMapsApiKey;
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY nao configurada nos secrets.');

    const report = await analyzeGbp(payload, apiKey);
    return json(report);
  } catch (error) {
    return json({ error: error?.message || 'Erro inesperado.' }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

async function googleGet(path: string, params: Record<string, unknown>, apiKey: string) {
  const url = new URL(`https://maps.googleapis.com/maps/api/place/${path}/json`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  url.searchParams.set('key', apiKey);
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status))) {
    throw new Error(data.error_message || data.status || `Google API error ${response.status}`);
  }
  return data;
}

async function analyzeGbp(payload: Record<string, any>, apiKey: string) {
  const rawQuery = String(payload.businessQuery || payload.gmnLink || '').trim();
  const query = extractReadableQuery(rawQuery).trim();
  const keyword = String(payload.keyword || '').trim();
  if (!query) throw new Error('Informe o link, nome ou endereco do perfil.');
  if (!keyword) throw new Error('Informe a palavra-chave.');

  const find = await googleGet('findplacefromtext', {
    input: query,
    inputtype: 'textquery',
    fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,business_status,types,photos',
    language: 'pt-BR',
  }, apiKey);

  const first = find.candidates?.[0];
  if (!first) throw new Error('Nao encontrei esse perfil. Tente informar nome + cidade ou endereco completo.');

  const detailsData = await googleGet('details', {
    place_id: first.place_id,
    language: 'pt-BR',
    fields: 'place_id,name,formatted_address,geometry,rating,user_ratings_total,formatted_phone_number,international_phone_number,website,url,opening_hours,business_status,types,price_level,photos,reviews',
  }, apiKey);

  const detailsRaw = detailsData.result;
  const businessLocation = locationOf(detailsRaw.geometry.location);
  const requestedCenter = extractMapCenter(payload.searchCenter || '');
  const center = requestedCenter ? { lat: requestedCenter.lat, lng: requestedCenter.lng } : businessLocation;
  const centerSource = requestedCenter ? requestedCenter.source : 'business';
  const radiusKm = Math.max(0.5, Math.min(20, Number(payload.radiusKm) || 3));
  const gridSize = Math.max(3, Math.min(9, Number(payload.gridSize) || 5));
  const requestedSearchRadius = Number(payload.searchRadiusMeters);
  const searchBiasMeters = Number.isFinite(requestedSearchRadius) && requestedSearchRadius > 0
    ? Math.round(Math.min(50000, Math.max(100, requestedSearchRadius)))
    : Math.round(Math.min(50000, Math.max(300, radiusKm * 1000)));
  const points = gridPoints(center, radiusKm, gridSize);

  const localResults = [];
  for (const point of points) {
    const search = await googleGet('textsearch', {
      query: keyword,
      location: `${point.lat},${point.lng}`,
      radius: searchBiasMeters,
      language: 'pt-BR',
    }, apiKey);
    const results = (search.results || []).slice(0, 20).map(normalizePlace);
    const positionIndex = results.findIndex((place: any) => place.placeId === detailsRaw.place_id);
    localResults.push({ point, position: positionIndex >= 0 ? positionIndex + 1 : null, found: positionIndex >= 0, results });
  }

  const details = {
    placeId: detailsRaw.place_id,
    name: detailsRaw.name,
    address: detailsRaw.formatted_address,
    rating: detailsRaw.rating || null,
    userRatingsTotal: detailsRaw.user_ratings_total || 0,
    phone: detailsRaw.formatted_phone_number || detailsRaw.international_phone_number || '',
    website: detailsRaw.website || '',
    googleUrl: detailsRaw.url || '',
    location: businessLocation,
    businessStatus: detailsRaw.business_status || '',
    types: detailsRaw.types || [],
    priceLevel: detailsRaw.price_level ?? null,
    photos: detailsRaw.photos?.length || 0,
    weekdayText: detailsRaw.opening_hours?.weekday_text || [],
    reviews: detailsRaw.reviews || [],
    unansweredReviews: (detailsRaw.reviews || []).filter((review: any) => !review.author_reply).length,
    totalReviewsFromApi: (detailsRaw.reviews || []).length,
  };

  const metrics = summarizeOwnRanking(localResults);
  const competitors = summarizeCompetitors(localResults, center).filter((item: any) => item.placeId !== details.placeId);
  const health = scoreProfile(details, localResults, metrics);
  const half = Math.max(1, Math.floor(gridSize / 2));

  return {
    generatedAt: new Date().toISOString(),
    query,
    keyword,
    radiusKm,
    searchBiasMeters,
    gridStepKm: Number((radiusKm / half).toFixed(3)),
    gridSize,
    searchAreaKm2: Number((radiusKm * 2 * (radiusKm * 2)).toFixed(2)),
    center,
    centerSource,
    distanceBusinessToCenterKm: Number(haversineKm(businessLocation, center).toFixed(3)),
    warning: radiusKm > 3
      ? `Raio de ${radiusKm} km gera uma area muito ampla para ranking local. Para comparar com relatorios de bairro, use 0,5 km ou 1 km.`
      : '',
    details,
    metrics,
    localResults,
    rankingMatrix: buildRankingMatrix(localResults),
    competitors,
    health,
    recommendations: buildRecommendations(details, metrics, competitors),
  };
}

function extractReadableQuery(input: string) {
  if (!input) return '';
  try {
    const url = new URL(input);
    const query = url.searchParams.get('q') || url.searchParams.get('query');
    if (query) return query;
    const placeIndex = url.pathname.indexOf('/place/');
    if (placeIndex >= 0) {
      const raw = url.pathname.slice(placeIndex + 7).split('/')[0];
      return decodeURIComponent(raw.replaceAll('+', ' '));
    }
  } catch {
    return input;
  }
  return input;
}

function extractMapCenter(input: string): (Point & { source?: string }) | null {
  if (!input) return null;
  const text = String(input);
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|z|$)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]), source: 'url' };
  const pairMatch = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  return pairMatch ? { lat: Number(pairMatch[1]), lng: Number(pairMatch[2]), source: 'manual' } : null;
}

function locationOf(location: any): Point {
  return { lat: typeof location.lat === 'function' ? location.lat() : location.lat, lng: typeof location.lng === 'function' ? location.lng() : location.lng };
}

function gridPoints(center: Point, radiusKm: number, gridSize: number) {
  const points: Point[] = [];
  const half = Math.floor(gridSize / 2);
  const latKm = 110.574;
  const lngKm = 111.32 * Math.cos((center.lat * Math.PI) / 180);
  for (let y = -half; y <= half; y += 1) {
    for (let x = -half; x <= half; x += 1) {
      points.push({ lat: center.lat + (y * radiusKm) / half / latKm, lng: center.lng + (x * radiusKm) / half / lngKm, x, y });
    }
  }
  return points;
}

function normalizePlace(place: any) {
  return {
    placeId: place.place_id,
    name: place.name,
    address: place.formatted_address || place.vicinity || '',
    rating: place.rating || null,
    userRatingsTotal: place.user_ratings_total || 0,
    businessStatus: place.business_status || '',
    location: place.geometry?.location ? locationOf(place.geometry.location) : null,
    types: place.types || [],
    priceLevel: place.price_level ?? null,
    openNow: place.opening_hours?.open_now ?? null,
    photos: place.photos?.length || 0,
  };
}

function summarizeOwnRanking(localResults: any[]) {
  const totalPoints = localResults.length;
  const missingPosition = 21;
  const positions = localResults.filter((item) => item.position).map((item) => item.position);
  const totalPosition = positions.reduce((sum, position) => sum + position, 0);
  const top3 = positions.filter((position) => position <= 3).length;
  const top10 = positions.filter((position) => position <= 10).length;
  return {
    visibility: Math.round((positions.length / totalPoints) * 100),
    averagePosition: positions.length ? Number((totalPosition / positions.length).toFixed(2)) : null,
    arp: positions.length ? Number((totalPosition / positions.length).toFixed(2)) : null,
    atrp: Number(((totalPosition + (totalPoints - positions.length) * missingPosition) / totalPoints).toFixed(2)),
    solv: Number(((top3 / totalPoints) * 100).toFixed(2)),
    top3,
    top10,
    foundPoints: positions.length,
    totalPoints,
    bestPosition: positions.length ? Math.min(...positions) : null,
    worstPosition: positions.length ? Math.max(...positions) : null,
  };
}

function summarizeCompetitors(results: any[], center: Point) {
  const byId = new Map();
  const totalPoints = results.length;
  const missingPosition = 21;
  for (const search of results) {
    search.results.forEach((place: any, index: number) => {
      if (!byId.has(place.placeId)) {
        byId.set(place.placeId, {
          ...place,
          appearances: 0,
          bestPosition: index + 1,
          totalPosition: 0,
          top3: 0,
          distanceKm: place.location ? haversineKm(center, place.location) : null,
        });
      }
      const current = byId.get(place.placeId);
      current.appearances += 1;
      current.bestPosition = Math.min(current.bestPosition, index + 1);
      current.totalPosition += index + 1;
      if (index + 1 <= 3) current.top3 += 1;
    });
  }
  return [...byId.values()].map((item: any) => ({
    ...item,
    foundLabel: `${item.appearances} / ${totalPoints}`,
    visibility: Number(((item.appearances / totalPoints) * 100).toFixed(2)),
    arp: Number((item.totalPosition / item.appearances).toFixed(2)),
    atrp: Number(((item.totalPosition + (totalPoints - item.appearances) * missingPosition) / totalPoints).toFixed(2)),
    solv: Number(((item.top3 / totalPoints) * 100).toFixed(2)),
    averagePosition: Number((item.totalPosition / item.appearances).toFixed(1)),
  })).sort((a: any, b: any) => b.visibility - a.visibility || a.atrp - b.atrp).slice(0, 60);
}

function scoreProfile(details: any, localResults: any[], metrics: any) {
  const checks = [
    {
      label: 'Nome e endereco encontrados',
      ok: Boolean(details.name && details.address),
      weight: 12,
      observation: details.name && details.address ? 'O perfil tem identificacao e endereco principal preenchidos.' : 'Nome ou endereco nao foram encontrados na consulta.',
      recommendation: details.name && details.address
        ? 'Mantenha nome, endereco e bairro iguais em site, redes sociais e diretorios.'
        : 'Corrija o nome/endereco no Perfil da Empresa e padronize esses dados em todos os canais.',
    },
    {
      label: 'Nota acima de 4,3',
      ok: Number(details.rating || 0) >= 4.3,
      weight: 14,
      observation: details.rating ? `Nota atual: ${details.rating}.` : 'Nao encontrei nota publica no perfil.',
      recommendation: Number(details.rating || 0) >= 4.3
        ? 'Continue pedindo avaliacoes recentes e responda todas, principalmente as negativas.'
        : 'Crie uma rotina de pedido de avaliacoes apos atendimento e responda avaliacoes antigas com tom profissional.',
    },
    {
      label: 'Volume de avaliacoes competitivo',
      ok: Number(details.userRatingsTotal || 0) >= 30,
      weight: 14,
      observation: `Total encontrado: ${details.userRatingsTotal || 0} avaliacoes.`,
      recommendation: Number(details.userRatingsTotal || 0) >= 30
        ? 'Compare o volume com os 5 concorrentes que mais aparecem e busque crescimento constante.'
        : 'Defina uma meta mensal de novas avaliacoes e use link direto de avaliacao em WhatsApp, QR code e pos-venda.',
    },
    {
      label: 'Avaliacoes respondidas',
      ok: details.totalReviewsFromApi === 0 || details.unansweredReviews === 0,
      weight: 10,
      observation: details.totalReviewsFromApi > 0
        ? `${details.unansweredReviews} de ${details.totalReviewsFromApi} avaliacoes recentes sem resposta (a API retorna ate 5).`
        : 'Nenhuma avaliacao encontrada para verificar.',
      recommendation: (details.totalReviewsFromApi === 0 || details.unansweredReviews === 0)
        ? 'Continue respondendo todas as avaliacoes rapidamente para manter engajamento.'
        : 'Responda todas as avaliacoes, especialmente as negativas. Respostas do dono aumentam confianca e sinalizam engajamento ao algoritmo do Google.',
    },
    {
      label: 'Telefone cadastrado',
      ok: Boolean(details.phone),
      weight: 10,
      observation: details.phone ? `Telefone encontrado: ${details.phone}.` : 'Nenhum telefone foi retornado pela API.',
      recommendation: details.phone
        ? 'Teste se o numero atende rapido e mantenha o mesmo telefone no site e Instagram.'
        : 'Adicione telefone ou WhatsApp comercial no perfil para aumentar ligacoes e contatos.',
    },
    {
      label: 'Site cadastrado',
      ok: Boolean(details.website),
      weight: 10,
      observation: details.website ? `Site encontrado: ${details.website}.` : 'O perfil nao retornou site cadastrado.',
      recommendation: details.website
        ? 'Garanta que a pagina tenha categoria, servicos, endereco, telefone e marcacao local.'
        : 'Cadastre um site ou pagina de destino com servicos, endereco, telefone, fotos e botao de WhatsApp.',
    },
    {
      label: 'Horarios cadastrados',
      ok: Boolean(details.weekdayText?.length),
      weight: 10,
      observation: details.weekdayText?.length ? 'Horarios de funcionamento encontrados.' : 'Horarios nao foram encontrados.',
      recommendation: details.weekdayText?.length ? 'Revise feriados e horarios especiais para evitar perda de visitas.' : 'Cadastre horarios por dia da semana e horarios especiais em feriados.',
    },
    {
      label: 'Fotos no perfil',
      ok: details.photos > 0,
      weight: 10,
      observation: `Fotos retornadas pela consulta: ${details.photos}.`,
      recommendation: details.photos > 0 ? 'Publique fotos novas de fachada, equipe, ambiente, produtos e bastidores com frequencia.' : 'Adicione fotos reais da fachada, recepcao, equipe, produtos/servicos e bastidores.',
    },
    {
      label: 'Boa visibilidade no grid local',
      ok: metrics.visibility >= 60,
      weight: 20,
      observation: `Apareceu em ${localResults.filter((item) => item.position).length} de ${localResults.length} pontos analisados.`,
      recommendation: metrics.visibility >= 60 ? 'Mantenha o trabalho nos pontos amarelos e vermelhos para transformar presenca em top 3.' : 'A visibilidade esta baixa. Revise categoria principal, servicos, conteudo do site, avaliacoes e sinais locais para a palavra-chave.',
    },
    {
      label: 'Presenca no top 3',
      ok: metrics.solv >= 15,
      weight: 14,
      observation: `Ficou no top 3 em ${metrics.top3} de ${metrics.totalPoints} pontos (${metrics.solv}%).`,
      recommendation: metrics.solv >= 15 ? 'Acompanhe os pontos proximos do top 3 e compare fotos, avaliacoes e categorias dos lideres.' : 'O perfil quase nao aparece no top 3. Priorize avaliacoes recentes, categorias corretas e paginas locais focadas na palavra-chave.',
    },
    {
      label: 'Posicao media competitiva',
      ok: Boolean(metrics.averagePosition && metrics.averagePosition <= 10),
      weight: 14,
      observation: metrics.averagePosition ? `Posicao media quando encontrado: ${metrics.averagePosition}.` : 'O perfil nao foi encontrado no top 20.',
      recommendation: metrics.averagePosition && metrics.averagePosition <= 10 ? 'Trabalhe para converter posicoes 4 a 10 em top 3 nos bairros com maior oportunidade.' : 'A posicao media esta fraca. Estude concorrentes dominantes e aumente relevancia local para a busca analisada.',
    },
    {
      label: 'Fotos recentes no perfil',
      ok: null,
      manual: true,
      weight: 0,
      observation: `${details.photos} foto(s) encontrada(s). A API nao retorna a data de publicacao; verificar manualmente.`,
      recommendation: 'Publique fotos novas ao menos 1-2x por semana. Perfis com fotos recentes tem mais destaque no Maps.',
      profileUrl: details.googleUrl,
    },
    {
      label: 'Video no perfil',
      ok: null,
      manual: true,
      weight: 0,
      observation: 'A API nao retorna informacao sobre videos. Verificar manualmente se ha video cadastrado no perfil.',
      recommendation: 'Videos curtos de ambiente, equipe ou produtos aumentam engajamento e confianca no perfil.',
      profileUrl: details.googleUrl,
    },
  ];
  const scoreable = checks.filter((item) => !item.manual);
  const total = scoreable.reduce((sum, item) => sum + item.weight, 0);
  const earned = scoreable.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks };
}

function buildRankingMatrix(localResults: any[]) {
  return [...localResults].sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x).map((item) => ({
    x: item.point.x,
    y: item.point.y,
    lat: Number(item.point.lat.toFixed(6)),
    lng: Number(item.point.lng.toFixed(6)),
      position: item.position,
      label: item.position ? String(item.position) : '20+',
      found: item.found,
      topResult: item.results[0]?.name || '',
    }));
}

function buildRecommendations(details: any, metrics: any, competitors: any[]) {
  const recs = [];
  const betterCompetitors = competitors.filter((item) => item.atrp < metrics.atrp).slice(0, 5);
  if (metrics.visibility < 60) {
    recs.push({ priority: 'Alta', title: 'Aumentar cobertura na regiao analisada', body: `O perfil apareceu em ${metrics.foundPoints} de ${metrics.totalPoints} pontos. Trabalhe relevancia para a palavra-chave e sinais locais nos bairros onde a grade ficou vermelha.` });
  }
  if (metrics.solv < 20) {
    recs.push({ priority: 'Alta', title: 'Ganhar mais posicoes no top 3', body: `Apenas ${metrics.solv}% da grade ficou no top 3. O top 3 e a faixa que mais concentra cliques e rotas no Maps.` });
  }
  if (!details.website) recs.push({ priority: 'Media', title: 'Adicionar site ao perfil', body: 'Perfis com site completo passam mais confianca e ajudam o Google a confirmar categoria, servicos e localizacao.' });
  if (!details.phone) recs.push({ priority: 'Media', title: 'Adicionar telefone', body: 'Telefone ausente reduz conversao e enfraquece a consistencia dos dados comerciais.' });
  if (Number(details.rating || 0) < 4.3) recs.push({ priority: 'Media', title: 'Melhorar media de avaliacoes', body: 'A nota esta abaixo do patamar usado no diagnostico. Responder avaliacoes e aumentar volume recente ajuda reputacao e conversao.' });
  if (betterCompetitors.length) recs.push({ priority: 'Alta', title: 'Estudar concorrentes dominantes', body: `Concorrentes como ${betterCompetitors.map((item) => item.name).join(', ')} aparecem com desempenho superior na grade.` });
  return recs.length ? recs.slice(0, 6) : [{ priority: 'Baixa', title: 'Manter consistencia e frequencia', body: 'O perfil tem boa base. Mantenha fotos, posts, respostas e categorias atualizadas para defender as posicoes.' }];
}

function haversineKm(a: Point, b: Point) {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.sqrt(h));
}
