# ESB-HUNTER

Aplicação Next.js pronta para deploy na Vercel com o agente comercial ESB-HUNTER usando OpenAI Agents SDK.

## Recursos

- Login simples para equipe comercial.
- Chat com o agente ESB-HUNTER.
- Histórico salvo no navegador do usuário.
- Upload de arquivos para o vector store do OpenAI File Search.
- Dashboard de Prospecção com filtros por planilha/lista, cidade e busca por cliente.
- Mapa de prospecção com pins por lead e mini CRM lateral.
- Qualificação por cor: verde, amarelo, laranja e vermelho.
- Edição e exclusão do registro de atendimento por lead.
- Blocos de oportunidades do dia, pendências e descoberta de terceirizadas para rodovias.
- Editor de planilhas com importação/exportação XLSX/CSV.

## Dados de prospecção

A base inicial vem da planilha `Rodovias RS-SC-PR-SP.xlsx` e gera dois filtros no dashboard:

- `ADM CONDOMÍNIO - Litoral SC e Vale do Itajaí`
- `ADM Rodovias - SP, PR, SC e RS`

Os registros de atendimento do CRM ficam no navegador do usuário via `localStorage`.

## Variáveis de ambiente

Crie estas variáveis no projeto da Vercel:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
OPENAI_VECTOR_STORE_ID=vs_69fa3affced48191a19b7191589f6a6b
OPENAI_WORKFLOW_ID=wf_69fb8134c93c8190aaea8925010df00c0361d6656709f266
AUTH_USERNAME=comercial
AUTH_PASSWORD=
SESSION_SECRET=
```

Importante: se uma chave da OpenAI foi compartilhada fora do painel seguro, revogue e crie uma nova antes do deploy.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Publicar no GitHub e Vercel

1. Crie um repositório público no GitHub.
2. Faça o push desta pasta para o repositório.
3. Na Vercel, clique em **Add New Project** e importe o repositório.
4. Configure as variáveis de ambiente acima.
5. Faça o deploy.

O Vercel detecta Next.js automaticamente. Não é necessário criar `vercel.json`.
