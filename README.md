# OptionOS

Assistente inteligente para venda de PUT Cash Secured e Covered Call em blue chips brasileiras.

O sistema tem dois objetivos, e nada além disso:

1. Encontrar as melhores oportunidades de venda de opções (Central de Oportunidades, com Score 0–100).
2. Gerenciar e acompanhar as operações abertas e encerradas (Dashboard + Operações).

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + shadcn/ui (via Radix)
- **Backend:** Supabase (PostgreSQL + REST via `supabase-js`)
- **OCR:** Tesseract.js, 100% no navegador — nenhum print sai do seu computador
- **Gráficos:** Recharts
- **Hospedagem:** Vercel (free tier)
- **IA:** sem custo de API embutido — os botões "Analisar Operação" e "Analisar Carteira" geram um resumo
  formatado que você copia e cola em qualquer chat de IA (Claude, etc.)

## Estrutura

```
app/(dashboard)/dashboard      → Dashboard: KPIs e gráficos
app/(dashboard)/oportunidades  → Central de Oportunidades: importar prints, ranking por Score
app/(dashboard)/operacoes      → Acompanhamento de operações abertas/encerradas/roladas/exercidas
app/(dashboard)/calculadoras   → Calculadoras (contratos, capital, prêmio, IR, rentabilidade)
app/(dashboard)/configuracoes  → Estratégia (delta máx/mín, caixa) e pesos do Score

lib/scoring/engine.ts          → Motor de Score (0–100), pesos configuráveis
lib/ocr/                       → Extração de dados dos prints (gráfico + book de opções)
lib/calculations/finance.ts    → Calculadoras financeiras (IR 15%, rentabilidade, etc.)
lib/ai/prompt-builder.ts       → Geração dos resumos para análise via IA externa
lib/education/glossary.ts      → Explicações dos indicadores (Delta, Spread, Liquidez...)
supabase/migrations/           → Schema do banco (rodar em ordem)
```

## Passo a passo — colocar no ar do zero

### 1. Supabase (banco de dados)

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto (gratuito).
2. Dê um nome, ex. `optionos`, escolha a região mais próxima (São Paulo, se disponível) e uma senha de banco.
3. Aguarde o projeto provisionar (~2 minutos).
4. No menu lateral, vá em **SQL Editor** → **New query**.
5. Abra o arquivo `supabase/migrations/0001_initial_schema.sql` deste repositório, copie todo o conteúdo,
   cole no editor e clique em **Run**.
6. Repita o mesmo processo para `supabase/migrations/0002_rls_policies.sql`.
7. Vá em **Project Settings** (ícone de engrenagem) → **API**. Anote dois valores:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (uma chave longa começando com `eyJ...`)

Você vai usar esses dois valores no passo 3.

### 2. GitHub (versionamento)

O código já está neste repositório. Se quiser apenas confirmar que está tudo certo:

```bash
git clone https://github.com/DiogoMacapa/optionos.git
cd optionos
npm install
```

### 3. Vercel (hospedagem, gratuita)

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta do GitHub.
2. Clique em **Add New → Project**.
3. Selecione o repositório `optionos`.
4. Em **Environment Variables**, adicione as duas variáveis do Supabase que você anotou no passo 1:
   - `NEXT_PUBLIC_SUPABASE_URL` = a Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a anon public key
5. Clique em **Deploy**. Em 1–2 minutos o sistema estará no ar em uma URL tipo `optionos-xxxx.vercel.app`.

Pronto — o OptionOS está publicado, sem nenhum custo.

### 4. Rodando localmente (opcional, para testar antes de publicar)

```bash
cp .env.example .env.local
# edite .env.local com os mesmos valores do Supabase

npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Como funciona o fluxo diário

1. Abra o gráfico no Investing.com e o book de opções no BTG.
2. Tire prints (não precisa recortar — o sistema recorta as regiões relevantes automaticamente no caso do
   gráfico do Investing.com).
3. Em **Oportunidades → Importar print**, informe o ticker, arraste o print do gráfico e depois o do book.
4. Confira os valores extraídos pelo OCR na tela de confirmação (sempre obrigatória antes de salvar) e ajuste
   o que estiver errado.
5. O sistema calcula o Score de cada strike automaticamente e mostra o ranking.

## Sobre o OCR — o que esperar

Testado com prints reais do Investing.com:

| Dado | Confiabilidade |
|---|---|
| Ticker, preço, variação, faixas | Muito alta |
| OHLC (abertura/máxima/mínima/fechamento) | Muito alta |
| Bollinger Bands, RSI, MACD (como texto na tela) | Boa, com revisão |
| Book de opções (BTG) | Ainda não validado com print real — sempre revisar linha a linha |
| Tendência/padrões visuais do candle | Não é extraído por OCR — preencha manualmente |

Todo valor extraído passa por uma tela de confirmação antes de ser salvo. Nada é gravado no banco sem você revisar.

## Sobre a IA (Analisar Operação / Analisar Carteira)

Para manter o sistema 100% gratuito, esses botões não chamam nenhuma API paga. Eles montam um resumo
completo e formatado dos dados relevantes, que você copia (um clique) e cola em uma conversa com o Claude
ou outra IA de sua preferência.

## Próximos passos possíveis

- Validar e calibrar o OCR do book de opções do BTG com um print real.
- Aprendizado automático: estatísticas de ativo mais lucrativo, delta mais lucrativo, taxa de exercício —
  a estrutura de dados já suporta, falta a tela de relatórios agregados.
- Autenticação (hoje é single-user, sem login — RLS já preparado para adicionar depois).
