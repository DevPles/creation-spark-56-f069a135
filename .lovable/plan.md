

## Imagens dos itens do catálogo nos convites

Vamos adicionar uma foto opcional a cada item do catálogo de produtos. Essa imagem aparecerá no cadastro do item, na tela de requisição (ao escolher o item) e também na página pública que o fornecedor recebe pelo link de convite — assim ele clica, vê a imagem e cota com mais segurança.

---

### O que muda para o usuário

**1. Cadastro do item (Catálogo de Produtos)**
- Novo campo "Imagem do produto" no modal de cadastro/edição.
- Botão para enviar foto (JPG/PNG/WEBP, até 5 MB). Pré-visualização logo abaixo.
- Botão "Remover imagem" se já houver uma.
- Imagem é opcional — itens antigos continuam funcionando normalmente.

**2. Requisição de compra**
- Na lista de itens, ao lado da descrição, aparece uma miniatura clicável (quando o item do catálogo tem foto).
- Clicar abre a imagem ampliada.

**3. Página pública do convite (o que o fornecedor vê)**
- Nova coluna "Foto" antes da Descrição na tabela "Itens para cotar".
- Miniatura clicável; ao clicar, abre a imagem em tamanho maior numa janela.
- Itens sem foto mostram um espaço neutro "—".

---

### Detalhes técnicos

**Banco de dados**
- Nova coluna `image_url text` (nullable) na tabela `product_catalog`.
- Atualizar a função `get_invite_by_token` para incluir `image_url` em cada item retornado, fazendo `LEFT JOIN` por descrição+unidade ou — preferencialmente — adicionando uma coluna `product_id uuid` em `purchase_requisition_items` referenciando `product_catalog(id)` (para vínculo confiável). Itens existentes ficam com `product_id NULL` e seguem sem imagem.

**Storage**
- Novo bucket público `product-images` para armazenar as fotos.
- Políticas RLS:
  - SELECT público (qualquer um pode ver — necessário para fornecedor anônimo no convite).
  - INSERT/UPDATE/DELETE apenas para usuários autenticados.

**Frontend**
- `ProductCatalogModal.tsx`: input de arquivo + upload para o bucket + salvar `image_url` no registro.
- `PurchaseRequisitionModal.tsx`: ao selecionar item do catálogo, gravar `product_id` no item; mostrar miniatura na tabela.
- `PublicQuotationPage.tsx`: nova coluna "Foto" + Dialog para ampliar a imagem ao clicar.
- A função RPC `get_invite_by_token` será ajustada para incluir `image_url` resolvido via `product_id` → `product_catalog`.

**Compatibilidade**
- Tudo é opcional. Itens, requisições e convites antigos continuam funcionando — apenas não exibem foto.

---

### Arquivos afetados

- `supabase/migrations/` — nova migração: coluna `image_url`, coluna `product_id` em `purchase_requisition_items`, bucket `product-images` com policies, atualização da função `get_invite_by_token`.
- `src/components/purchases/ProductCatalogModal.tsx` — upload e exibição da imagem.
- `src/components/purchases/PurchaseRequisitionModal.tsx` — gravar `product_id` e mostrar miniatura.
- `src/pages/PublicQuotationPage.tsx` — coluna Foto + visualizador ampliado.

