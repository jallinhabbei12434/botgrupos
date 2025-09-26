
// =======================
// Bot Grupos WhatsApp - versão CommonJS (compatível EasyPanel)
// =======================

const express = require('express');
const axios = require('axios');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

// URL do Webhook do n8n (não muda)
const WEBHOOK_N8N = 'https://jallin-n8n.yqt2oi.easypanel.host/webhook/botresultados';

// Função que roda o Playwright nos links recebidos
async function rodarBot(links) {
  const urls = [];
  const sucessos = [];
  const falhas = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (const link of links) {
    try {
      console.log('🔎 Acessando:', link);
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Extrai o primeiro link que contenha chat.whatsapp.com ou devzap etc
      const element = await page.$('a[href*="whatsapp.com"], a[href*="devzap"], a[href*="zap"]');
      if (element) {
        const href = await element.getAttribute('href');
        if (href) {
          console.log('✅ Link encontrado:', href);
          urls.push(href);
          sucessos.push(href);
        } else {
          falhas.push(link);
        }
      } else {
        console.log('⚠️ Nenhum link encontrado na página:', link);
        falhas.push(link);
      }
    } catch (err) {
      console.error('❌ Erro ao processar link:', link, err.message);
      falhas.push(link);
    }
  }

  await browser.close();
  return { urls, sucessos, falhas };
}

// =======================
// Rota principal
// =======================
app.post('/update-links', async (req, res) => {
  const { links } = req.body;
  if (!links || !Array.isArray(links)) {
    return res.status(400).json({ error: 'Envie um array de links' });
  }

  try {
    const { urls, sucessos, falhas } = await rodarBot(links);

    // Envia também para o n8n
    try {
      const resp = await axios.post(WEBHOOK_N8N, { urls, sucessos, falhas });
      console.log("📤 Dados enviados ao n8n:", resp.status);
    } catch (err) {
      console.error("❌ Falha ao enviar pro n8n:", err.message);
    }

    // Resposta imediata
    res.json({ urls, sucessos, falhas });
  } catch (err) {
    console.error("❌ Erro geral:", err);
    res.status(500).json({ error: 'Erro interno no processamento' });
  }
});

// =======================
// Start Server
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Bot rodando na porta ${PORT}`);
});
