const defaultGoogleMapsApiKey = 'AIzaSyAyH7teIp1Xjprln7TaA1i_dIY8TB0_HgE';

export async function analyzeGbp(payload = {}) {
  const apiKey = payload.apiKey || process.env.GOOGLE_MAPS_API_KEY || defaultGoogleMapsApiKey;
  const query = extractReadableQuery(String(payload.businessQuery || payload.gmnLink || '').trim()).trim();
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

  const localResults = await mapWithConcurrency(points, 4, async (point) => {
    const search = await googleGet('textsearch', {
      query: keyword,
      location: `${point.lat},${point.lng}`,
      radius: searchBiasMeters,
      language: 'pt-BR',
    }, apiKey);
    const results = (search.results || []).slice(0, 20).map(normalizePlace);
    const positionIndex = results.findIndex((place) => place.placeId === detailsRaw.place_id);
    return { point, position: positionIndex >= 0 ? positionIndex + 1 : null, found: positionIndex >= 0, results };
  });

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
    unansweredReviews: (detailsRaw.reviews || []).filter((review) => !review.author_reply).length,
    totalReviewsFromApi: (detailsRaw.reviews || []).length,
  };
  const metrics = summarizeOwnRanking(localResults);
  const competitors = summarizeCompetitors(localResults, center).filter((item) => item.placeId !== details.placeId);
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
    warning: radiusKm > 3 ? `Raio de ${radiusKm} km gera uma area muito ampla para ranking local. Para comparar com relatorios de bairro, use 0,5 km ou 1 km.` : '',
    details,
    metrics,
    localResults,
    rankingMatrix: buildRankingMatrix(localResults),
    competitors,
    recommendations: buildRecommendations(details, metrics, competitors),
    health,
  };
}

async function googleGet(path, params, apiKey) {
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

function extractReadableQuery(input) {
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

function extractMapCenter(input) {
  if (!input) return null;
  const text = String(input);
  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|z|$)/);
  if (atMatch) return { lat: Number(atMatch[1]), lng: Number(atMatch[2]), source: 'url' };
  const pairMatch = text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  return pairMatch ? { lat: Number(pairMatch[1]), lng: Number(pairMatch[2]), source: 'manual' } : null;
}

function locationOf(location) {
  return { lat: typeof location.lat === 'function' ? location.lat() : location.lat, lng: typeof location.lng === 'function' ? location.lng() : location.lng };
}

function gridPoints(center, radiusKm, gridSize) {
  const points = [];
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

function normalizePlace(place) {
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

function summarizeOwnRanking(localResults) {
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

function summarizeCompetitors(results, center) {
  const byId = new Map();
  const totalPoints = results.length;
  const missingPosition = 21;
  for (const search of results) {
    search.results.forEach((place, index) => {
      if (!byId.has(place.placeId)) byId.set(place.placeId, { ...place, appearances: 0, bestPosition: index + 1, totalPosition: 0, top3: 0, distanceKm: place.location ? haversineKm(center, place.location) : null });
      const current = byId.get(place.placeId);
      current.appearances += 1;
      current.bestPosition = Math.min(current.bestPosition, index + 1);
      current.totalPosition += index + 1;
      if (index + 1 <= 3) current.top3 += 1;
    });
  }
  return [...byId.values()].map((item) => ({
    ...item,
    foundLabel: `${item.appearances} / ${totalPoints}`,
    visibility: Number(((item.appearances / totalPoints) * 100).toFixed(2)),
    arp: Number((item.totalPosition / item.appearances).toFixed(2)),
    atrp: Number(((item.totalPosition + (totalPoints - item.appearances) * missingPosition) / totalPoints).toFixed(2)),
    solv: Number(((item.top3 / totalPoints) * 100).toFixed(2)),
    averagePosition: Number((item.totalPosition / item.appearances).toFixed(1)),
  })).sort((a, b) => b.visibility - a.visibility || a.atrp - b.atrp).slice(0, 60);
}

function scoreProfile(details, localResults, metrics) {
  const checks = [
    { label: 'Nome e endereco encontrados', ok: Boolean(details.name && details.address), weight: 12, observation: details.name && details.address ? 'O perfil tem identificacao e endereco principal preenchidos.' : 'Nome ou endereco nao foram encontrados na consulta.', recommendation: 'Mantenha nome, endereco e bairro iguais em site, redes sociais e diretorios.' },
    { label: 'Nota acima de 4,3', ok: Number(details.rating || 0) >= 4.3, weight: 14, observation: details.rating ? `Nota atual: ${details.rating}.` : 'Nao encontrei nota publica no perfil.', recommendation: 'Continue pedindo avaliacoes recentes e responda todas.' },
    { label: 'Volume de avaliacoes competitivo', ok: Number(details.userRatingsTotal || 0) >= 30, weight: 14, observation: `Total encontrado: ${details.userRatingsTotal || 0} avaliacoes.`, recommendation: 'Defina uma meta mensal de novas avaliacoes.' },
    { label: 'Avaliacoes respondidas', ok: details.totalReviewsFromApi === 0 || details.unansweredReviews === 0, weight: 10, observation: details.totalReviewsFromApi > 0 ? `${details.unansweredReviews} de ${details.totalReviewsFromApi} avaliacoes recentes sem resposta.` : 'Nenhuma avaliacao encontrada para verificar.', recommendation: 'Responda todas as avaliacoes, especialmente as negativas.' },
    { label: 'Telefone cadastrado', ok: Boolean(details.phone), weight: 10, observation: details.phone ? `Telefone encontrado: ${details.phone}.` : 'Nenhum telefone foi retornado pela API.', recommendation: 'Adicione telefone ou WhatsApp comercial no perfil.' },
    { label: 'Site cadastrado', ok: Boolean(details.website), weight: 10, observation: details.website ? `Site encontrado: ${details.website}.` : 'O perfil nao retornou site cadastrado.', recommendation: 'Cadastre site ou pagina de destino.' },
    { label: 'Horarios cadastrados', ok: Boolean(details.weekdayText?.length), weight: 10, observation: details.weekdayText?.length ? 'Horarios de funcionamento encontrados.' : 'Horarios nao foram encontrados.', recommendation: 'Revise horarios normais e especiais.' },
    { label: 'Fotos no perfil', ok: details.photos > 0, weight: 10, observation: `Fotos retornadas pela consulta: ${details.photos}.`, recommendation: 'Publique fotos novas com frequencia.' },
    { label: 'Boa visibilidade no grid local', ok: metrics.visibility >= 60, weight: 20, observation: `Apareceu em ${localResults.filter((item) => item.position).length} de ${localResults.length} pontos analisados.`, recommendation: 'Trabalhe os pontos amarelos e vermelhos para ganhar top 3.' },
    { label: 'Presenca no top 3', ok: metrics.solv >= 15, weight: 14, observation: `Ficou no top 3 em ${metrics.top3} de ${metrics.totalPoints} pontos (${metrics.solv}%).`, recommendation: 'Priorize avaliacoes recentes, categorias corretas e paginas locais.' },
    { label: 'Posicao media competitiva', ok: Boolean(metrics.averagePosition && metrics.averagePosition <= 10), weight: 14, observation: metrics.averagePosition ? `Posicao media quando encontrado: ${metrics.averagePosition}.` : 'O perfil nao foi encontrado no top 20.', recommendation: 'Estude concorrentes dominantes e aumente relevancia local.' },
  ];
  const total = checks.reduce((sum, item) => sum + item.weight, 0);
  const earned = checks.reduce((sum, item) => sum + (item.ok ? item.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks };
}

function buildRankingMatrix(localResults) {
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

function buildRecommendations(details, metrics, competitors) {
  const recs = [];
  const betterCompetitors = competitors.filter((item) => item.atrp < metrics.atrp).slice(0, 5);
  if (metrics.visibility < 60) recs.push({ priority: 'Alta', title: 'Aumentar cobertura na regiao analisada', body: `O perfil apareceu em ${metrics.foundPoints} de ${metrics.totalPoints} pontos.` });
  if (metrics.solv < 20) recs.push({ priority: 'Alta', title: 'Ganhar mais posicoes no top 3', body: `Apenas ${metrics.solv}% da grade ficou no top 3.` });
  if (!details.website) recs.push({ priority: 'Media', title: 'Adicionar site ao perfil', body: 'Site completo ajuda categoria, servicos e localizacao.' });
  if (!details.phone) recs.push({ priority: 'Media', title: 'Adicionar telefone', body: 'Telefone ausente reduz conversao.' });
  if (betterCompetitors.length) recs.push({ priority: 'Alta', title: 'Estudar concorrentes dominantes', body: `Concorrentes como ${betterCompetitors.map((item) => item.name).join(', ')} aparecem melhor na grade.` });
  return recs.length ? recs.slice(0, 6) : [{ priority: 'Baixa', title: 'Manter consistencia e frequencia', body: 'Mantenha fotos, posts, respostas e categorias atualizadas.' }];
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function haversineKm(a, b) {
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
