import { supabase } from '../supabase.js';
import { validateMap } from './model.js';
export async function listMaps() {
  const { data, error } = await supabase.from('mapas_mentais').select('id,title,updated_at,revision').eq('archived', false).order('updated_at', { ascending: false });
  if (error) throw error; return data;
}
export async function loadMap(id) {
  const { data, error } = await supabase.from('mapas_mentais').select('*').eq('id', id).eq('archived', false).single();
  if (error) throw error; validateMap({ title: data.title, nodes: data.document.nodes }); return data;
}
export async function saveMap(map, record) {
  validateMap(map);
  const values = { title: map.title.trim(), document: { nodes: map.nodes }, revision: (record?.revision || 0) + 1 };
  const query = record ? supabase.from('mapas_mentais').update(values).eq('id', record.id).eq('revision', record.revision).eq('archived', false) : supabase.from('mapas_mentais').insert(values);
  const { data, error } = await query.select('id,revision').maybeSingle();
  if (error) throw error;
  if (!data) throw Error('Este mapa mudou em outra aba. Exporte sua cópia antes de reabrir a versão salva.');
  return data;
}
