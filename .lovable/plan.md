

# Plano de Revisão Final + Notificações por E-mail

## Estado Atual do Sistema

Após auditoria completa, o sistema está bem integrado com o banco de dados. Os dados mock foram eliminados. Restam dois pontos a corrigir e uma funcionalidade nova a implementar.

## Problemas Encontrados

### 1. Timeline hardcoded no Relatório Assistencial (MENOR)
A página `RelatorioAssistencialPage.tsx` (linhas 79-86) contém 6 itens de timeline com dados de exemplo. Estes itens são editáveis inline pelo usuário, servindo como template inicial. Recomendação: substituir por array vazio para que o usuário crie os seus próprios itens.

### 2. Notificação de metas em risco por e-mail (NOVO — solicitado)
O campo `notification_email` já existe nos contratos e tem input no formulário. Porém, **não existe edge function** para enviar os alertas semanais. Precisa ser criada toda a infraestrutura de envio.

## Plano de Implementação

### Etapa 1: Configurar domínio de e-mail
Para enviar e-mails do sistema, é necessário configurar um domínio de e-mail primeiro. Isso é feito através das configurações do projeto. Será apresentado o botão de configuração para você completar este passo.

### Etapa 2: Criar Edge Function `check-goals-notify`
Uma nova edge function que:
1. Busca todos os contratos com `notification_email` preenchido
2. Para cada contrato, busca as metas da unidade e seus lançamentos
3. Calcula o atingimento semanal (meta mensal ÷ 4)
4. Se o atingimento acumulado estiver abaixo do esperado, envia e-mail ao endereço cadastrado
5. O e-mail lista as metas em risco com seus percentuais e valores financeiros

### Etapa 3: Agendar execução semanal via pg_cron
Configurar um cron job que executa a edge function toda segunda-feira às 8h, verificando automaticamente as metas e disparando alertas.

### Etapa 4: Limpar timeline hardcoded
Substituir os 6 itens de exemplo no `RelatorioAssistencialPage` por array vazio.

## Pré-requisito
Antes de implementar o envio de e-mail, você precisa configurar um domínio de e-mail. Clique no botão abaixo para iniciar a configuração.

<lov-actions>
<lov-open-email-setup>Configurar domínio de e-mail</lov-open-email-setup>
</lov-actions>

