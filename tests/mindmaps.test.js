import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { newMap, validateMap, reparent, layout } from '../frontend/js/mindmaps/model.js';
test('moving a branch preserves descendants and rejects cycles', () => {
 const m = newMap(), r = m.nodes[0];
 const node = (id,parent) => ({...r,id,parent,text:id});
 m.nodes.push(node('a',r.id),node('b','a'),node('c',r.id));
 assert.throws(()=>reparent(m,'a','b'));
 reparent(m,'a','c'); assert.equal(m.nodes.find(n=>n.id==='b').parent,'a'); validateMap(m);
 assert.throws(()=>validateMap({...m,nodes:[...m.nodes,node('a',r.id)]}));
 m.nodes.find(n=>n.id==='c').collapsed=true;
 assert.equal(layout(m).positions.length,2);
});
test('database allows admin only, denies anonymous writes and stale revisions', async () => {
 const db = new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated;
 create function public.is_main_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false') = 'true' $$;
 create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;`);
 await db.exec(readFileSync('supabase/migrations/20261101170000_mapas_mentais.sql','utf8'));
 await db.exec(`set role authenticated; set test.admin='true'; insert into public.mapas_mentais(title,document) values ('Mapa','{"nodes":[{}]}');`);
 assert.equal((await db.query('select * from public.mapas_mentais')).rows.length,1);
 await db.exec(`update public.mapas_mentais set revision=2 where revision=1`);
 assert.equal((await db.query('update public.mapas_mentais set revision=3 where revision=1 returning id')).rows.length,0);
 await db.exec(`set test.admin='false'`);
 assert.equal((await db.query('select * from public.mapas_mentais')).rows.length,0);
 await assert.rejects(db.exec(`insert into public.mapas_mentais(title,document) values ('X','{"nodes":[{}]}')`));
 await db.exec('set role anon'); await assert.rejects(db.query('select * from public.mapas_mentais'));
 } finally { await db.close(); }
});

test('templates have independent identities, movable positions and valid extra connections', async () => {
 const { templates, fromTemplate, connectTopics } = await import('../frontend/js/mindmaps/model.js');
 for (const template of templates) {
  const a = fromTemplate(template.id), b = fromTemplate(template.id);
  assert.notEqual(a.nodes[0].id,b.nodes[0].id); validateMap(a);
  const from = a.nodes[1].id, to = a.nodes.at(-1).id;
  connectTopics(a,from,to); assert.throws(()=>connectTopics(a,to,from)); assert.throws(()=>connectTopics(a,from,from));
  a.nodes[1].position={x:680,y:720}; assert.equal(layout(a).positions.find(n=>n.id===from).x,680);
  const roundtrip=JSON.parse(JSON.stringify(a)); validateMap(roundtrip); assert.equal(roundtrip.connections.length,1);
  assert.equal(roundtrip.nodes[1].position.y,720);
  a.nodes[1].position.x=Infinity; assert.throws(()=>validateMap(a));
 }
});
