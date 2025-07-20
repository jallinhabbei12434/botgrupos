const { chromium } = require('playwright');
const fs = require('fs');

// ==== Funções auxiliares ====
function limparURL(url) {
  try {
    return url.split('?')[0].split('#')[0];
  } catch {
    return url;
  }
}

function carregarSetDeArquivo(caminho) {
  if (!fs.existsSync(caminho)) return new Set();
  return new Set(fs.readFileSync(caminho, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean));
}

function salvarLinhaUnica(caminho, setExistente, novaLinha) {
  if (!setExistente.has(novaLinha)) {
    fs.appendFileSync(caminho, novaLinha + '\n');
    setExistente.add(novaLinha);
  }
}

function removerLinhaDeArquivo(caminho, linhaParaRemover) {
  if (!fs.existsSync(caminho)) return;
  const linhas = fs.readFileSync(caminho, 'utf8').split(/\r?\n/).filter(Boolean);
  const filtradas = linhas.filter(l => l.trim() !== linhaParaRemover.trim());
  fs.writeFileSync(caminho, filtradas.join('\n') + (filtradas.length ? '\n' : ''));
}

// ==== Carregar listas ====
const urlsBase = fs.readFileSync('links.txt', 'utf-8').split(/\r?\n/).map(u => u.trim()).filter(Boolean);

const setSucesso = carregarSetDeArquivo('sucessos.txt');
const setFalha = carregarSetDeArquivo('falhas.txt');
const setFinal = carregarSetDeArquivo('urls.txt'); // links finais chat.whatsapp

(async () => {
  console.log('🔎 Iniciando varredura em', urlsBase.length, 'URLs...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 375, height: 812 },
  });

  await context.route('**/*', route => {
    const type = route.request().resourceType();
    if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
      route.abort();
    } else {
      route.continue();
    }
  });

  const keywords = [
    'whats', 'zap', 'grupo', 'entrar', 'participar', 'join',
    'acessar', 'acesso', 'vip', 'exclusivo', 'evento', 'turma', 'link'
  ];

  for (const urlRaw of urlsBase) {
    const url = limparURL(urlRaw);
    console.log('\n🌐 Acessando página:', url);

    let page;
    try {
      page = await context.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

      const elements = await page.$$('a,button');
      let linkCapturado = null;

      for (const el of elements) {
        const txt = ((await el.innerText()) || '').toLowerCase();
        if (keywords.some(k => txt.includes(k))) {
          console.log('🔍 Botão suspeito encontrado com texto:', txt);
          try {
            await el.scrollIntoViewIfNeeded?.().catch(()=>{});
            const [newPage] = await Promise.all([
              context.waitForEvent('page').catch(() => null),
              page.evaluate(elm => { elm.click(); }, el)
            ]);

            if (newPage) {
              await newPage.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
              linkCapturado = newPage.url();
              await newPage.close().catch(() => {});
            } else {
              await page.waitForTimeout(2000);
              linkCapturado = page.url();
            }
          } catch (err) {
            console.error('⚠️ Erro ao clicar:', err.message);
          }
          if (linkCapturado) break;
        }
      }

      if (linkCapturado && linkCapturado.includes('chat.whatsapp.com')) {
        console.log('✅ Link WhatsApp capturado:', linkCapturado);
        salvarLinhaUnica('urls.txt', setFinal, linkCapturado);

        // Atualizar listas de sucesso/falha
        salvarLinhaUnica('sucessos.txt', setSucesso, url);
        if (setFalha.has(url)) {
          removerLinhaDeArquivo('falhas.txt', url);
          setFalha.delete(url);
        }
      } else {
        console.log('❌ Nenhum link válido encontrado nesta página.');
        salvarLinhaUnica('falhas.txt', setFalha, url);
        if (setSucesso.has(url)) {
          removerLinhaDeArquivo('sucessos.txt', url);
          setSucesso.delete(url);
        }
      }

    } catch (err) {
      console.error('❌ Erro ao acessar', url, ':', err.message);
      salvarLinhaUnica('falhas.txt', setFalha, url);
      if (setSucesso.has(url)) {
        removerLinhaDeArquivo('sucessos.txt', url);
        setSucesso.delete(url);
      }
    } finally {
      if (page) await page.close();
    }
  }

  await browser.close();
  console.log('\n🏁 Processo concluído.');
})();
