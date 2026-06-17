alter table public.vendas_cliente
  drop constraint if exists vendas_cliente_origem_check;

alter table public.vendas_cliente
  add constraint vendas_cliente_origem_check
  check (origem in ('meta_ads', 'google_ads', 'instagram', 'whatsapp', 'site', 'loja_fisica', 'indicacao', 'organico', 'shopify', 'woocommerce', 'crm', 'manual', 'outro'));
