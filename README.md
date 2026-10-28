# Águia Leads

Encontra empresas **reais** sem site (direto do Google Maps) e abre a conversa no WhatsApp com uma mensagem personalizada que você revisa e envia.

## Como funciona
- `app/api/buscar/route.ts`: busca no Google Places API (New) pelo nicho e cidade (até 60 empresas por busca), descarta quem tem site próprio e devolve só quem tem telefone. Quem usa só Instagram/Facebook no lugar do site também entra. A chave do Google fica só no servidor.
- `components/ChamarWhatsApp.tsx`: abre `wa.me/55<número>?text=<mensagem>`. A mensagem é montada com o nome, a cidade, o bairro e a nota da empresa, a partir de 4 aberturas que você escolhe e edita. O envio é sempre manual.
- Contador "WhatsApp hoje: X de 20" e opção "pediu para não receber mensagens", que tira a empresa da lista.

## Rodar na Vercel
1. Na Vercel: **Add New → Project** e importe este repositório (Next.js é detectado sozinho).
2. Em **Environment Variables**, adicione:
   - `GOOGLE_PLACES_API_KEY`: sua chave do Google Cloud, com a **Places API (New)** ativada.
   - `APP_SENHA`: uma senha qualquer. Sem ela, qualquer pessoa que achar o link pode gastar sua cota do Google.
3. Clique em **Deploy**.

## Rodar no computador
```bash
cp .env.example .env.local   # preencha a chave e a senha
npm install
npm run dev
```

## Custo do Google
Cada busca usa até 3 páginas do Text Search. Com os campos de telefone e site, o Google cobra cada página na faixa "Enterprise" (confira a tabela atual em https://developers.google.com/maps/billing-and-pricing/pricing). Buscas iguais em até 6 horas reaproveitam o resultado. Coloque um limite de gasto diário no Google Cloud.

## Próximos passos
Login e planos (Supabase + Mercado Pago), gerador de site, hospedagem e atualização diária, conforme o plano técnico.
