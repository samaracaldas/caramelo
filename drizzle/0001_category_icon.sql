ALTER TABLE "categories" ADD COLUMN "icon" text DEFAULT 'tag' NOT NULL;--> statement-breakpoint
-- Categorias que já existiam ganham um ícone pelo nome (mesma ideia de suggestIcon em src/lib/category-icon-keys.ts)
UPDATE "categories" SET "icon" = CASE
  WHEN "name" ~* 'venda|balc[aã]o|loja' THEN 'storefront'
  WHEN "name" ~* 'encomenda|pedido|embalage' THEN 'package'
  WHEN "name" ~* 'delivery|entrega|ifood' THEN 'moped'
  WHEN "name" ~* 'insumo|ingrediente|mercado' THEN 'basket'
  WHEN "name" ~* 'aluguel|condom' THEN 'house'
  WHEN "name" ~* 'folha|sal[aá]rio|funcion' THEN 'users'
  WHEN "name" ~* 'luz|energia' THEN 'lightning'
  WHEN "name" ~* '[aá]gua' THEN 'drop'
  WHEN "name" ~* 'marketing|an[uú]ncio' THEN 'megaphone'
  WHEN "name" ~* 'imposto|taxa' THEN 'receipt'
  ELSE 'tag'
END;
