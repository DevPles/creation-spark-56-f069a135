

## Convite a Fornecedores com Cadastro Integrado

Hoje em **Convidar fornecedores** você precisa redigitar nome, CNPJ, e-mail e telefone toda vez. Vamos integrar o modal ao **cadastro de fornecedores** já existente (`suppliers`) e oferecer envio direto por **e-mail** e **WhatsApp**.

### O que será construído

**1. Seleção a partir do cadastro**
- No topo do bloco "Adicionar fornecedor", um seletor **"Escolher fornecedor cadastrado"** (combobox com busca por nome / CNPJ).
- Ao selecionar → preenche automaticamente Nome, CNPJ, E-mail e Telefone (campos ficam editáveis para ajustes pontuais).
- Botão alternativo **"Inserir manualmente"** mantém o fluxo atual de digitação livre (sem precisar cadastrar antes).
- Se o usuário digitar manualmente um CNPJ que já existe → aviso "Fornecedor já cadastrado — usar dados do cadastro?".

**2. Cadastro inline (sem sair do modal)**
- Botão **"Novo fornecedor"** abre um mini-form (Nome, CNPJ, E-mail, Telefone) que grava em `suppliers` e já seleciona para o convite.
- Após gerar o convite, se os dados vieram do modo manual e ainda não existem em `suppliers`, oferece **"Salvar este fornecedor no cadastro"** (1 clique).

**3. Envio direto por E-mail e WhatsApp**
Na lista "Convites enviados", além de **Copiar link**, adicionar:
- **Enviar por e-mail** → abre `mailto:` pré-preenchido com:
  - Destinatário: e-mail do fornecedor
  - Assunto: `Cotação ${numero_requisicao} — ${unidade}`
  - Corpo: saudação + descrição da requisição + link único + prazo de validade.
- **Enviar por WhatsApp** → abre `https://wa.me/<telefone>?text=<mensagem>` com a mesma mensagem (telefone normalizado: só dígitos, com código do país 55 se ausente).
- Ambos os botões só ficam ativos se o respectivo contato existir; ao clicar, o convite passa de `pendente` → `enviado` e registra no `purchase_audit_log` (`action='invite_sent_email'` ou `'invite_sent_whatsapp'`).

**4. Pequenos ajustes de UX**
- Mensagem padrão editável (textarea opcional) — útil para reaproveitar o mesmo texto entre fornecedores.
- Botão "Copiar mensagem completa" (link + texto) para colar em qualquer canal.
- Indicação visual ao lado do nome quando o fornecedor já está no cadastro (badge "Cadastrado").

### Alterações técnicas

- **Frontend (`src/components/purchases/SupplierInviteModal.tsx`)**:
  - Carregar `suppliers` (ativos, ordem alfabética) ao abrir.
  - Adicionar `Combobox` + toggle "Manual / Do cadastro".
  - Mini-form de criação rápida (reusa lógica do `SupplierRegistryModal`).
  - Novas ações na linha do convite: botões "E-mail" e "WhatsApp" ao lado de "Copiar link".
  - Função `buildInviteMessage(invite, requisicao)` para padronizar o texto.
  - Após envio (e-mail/WhatsApp): `update quotation_invites set status='enviado'` + log em `purchase_audit_log`.

- **Banco**: nenhuma migração nova — `suppliers` e `quotation_invites` já existem.

### Comportamento final

- Abro **Convidar** → escolho "Cirúrgica Mafra" da lista → dados preenchem sozinhos.
- Clico em **WhatsApp** → abre conversa pronta com o link.
- Ou clico em **E-mail** → cliente de e-mail abre com tudo redigido.
- Se for um fornecedor novo, posso digitar na hora e ainda salvar no cadastro com 1 clique para reusar depois.

