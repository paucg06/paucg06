const fs = require('fs');
const https = require('https');
const path = require('path');

function fetchJson(urlStr, headers = {}) {
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'NodeJS-Stats-Sync',
        ...headers
      }
    };
    https.get(urlStr, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location, headers));
      }
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function getStats() {
  const currentYear = new Date().getFullYear();
  const startYear = 2017;
  const yearsExp = Math.max(1, currentYear - startYear);
  const ageText = `+ ${yearsExp} Años Como Solo Developer`;

  // 1. Obtener juegos de EternoDev
  let gamesCount = 7; // Valor de respaldo por defecto
  const gamesData = await fetchJson('https://raw.githubusercontent.com/paucg06/EternoDev/main/games.json');
  if (Array.isArray(gamesData) && gamesData.length > 0) {
    gamesCount = gamesData.length;
  }

  // 2. Obtener apps escaneando temas/topics de GitHub o fallback
  let appsCount = 5;
  const githubHeaders = process.env.GITHUB_TOKEN ? { 'Authorization': `Bearer ${process.env.GITHUB_TOKEN}` } : {};
  
  try {
    const userRepos = await fetchJson('https://api.github.com/users/paucg06/repos?per_page=100', githubHeaders);
    let taggedApps = 0;
    if (Array.isArray(userRepos)) {
      const appTopics = ['app', 'mobile-app', 'android-app', 'ios-app', 'application', 'mobile'];
      for (const repo of userRepos) {
        if (!repo.fork) {
          const topics = repo.topics || [];
          if (topics.some(t => appTopics.includes(t.toLowerCase()))) {
            taggedApps++;
          }
        }
      }
    }
    if (taggedApps > 0) {
      appsCount = taggedApps;
    }
  } catch (e) {
    console.warn('No se pudieron consultar repos de GitHub:', e.message);
  }

  return {
    yearsExp,
    ageText,
    gamesCount: String(gamesCount).padStart(2, '0'),
    appsCount: String(appsCount).padStart(2, '0')
  };
}

function updateSvgFile(filePath, stats) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');

  // Total de ancho de línea = 59 caracteres
  // 1. Actividad: '. Actividad:' (12 chars) + dots + ' ' + ageText
  const agePrefixLen = 12; // ". Actividad:"
  const ageDotsCount = Math.max(2, 59 - agePrefixLen - 1 - stats.ageText.length);
  const ageDots = ' ' + '.'.repeat(ageDotsCount) + ' ';

  content = content.replace(
    /<tspan class="cc" id="age_data_dots">[^<]*<\/tspan><tspan class="value" id="age_data">[^<]*<\/tspan>/,
    `<tspan class="cc" id="age_data_dots">${ageDots}</tspan><tspan class="value" id="age_data">${stats.ageText}</tspan>`
  );

  // 2. Apps Creadas: '. Apps Creadas:' (15 chars) + dots + ' ' + appsCount
  const appsPrefixLen = 15;
  const appsDotsCount = Math.max(2, 59 - appsPrefixLen - 1 - stats.appsCount.length);
  const appsDots = ' ' + '.'.repeat(appsDotsCount) + ' ';

  content = content.replace(
    /<tspan class="cc" id="repo_data_dots">[^<]*<\/tspan><tspan class="value" id="repo_data">[^<]*<\/tspan>/,
    `<tspan class="cc" id="repo_data_dots">${appsDots}</tspan><tspan class="value" id="repo_data">${stats.appsCount}</tspan>`
  );

  // 3. Juegos Creados: '. Juegos Creados:' (17 chars) + dots + ' ' + gamesCount
  const gamesPrefixLen = 17;
  const gamesDotsCount = Math.max(2, 59 - gamesPrefixLen - 1 - stats.gamesCount.length);
  const gamesDots = ' ' + '.'.repeat(gamesDotsCount) + ' ';

  content = content.replace(
    /<tspan class="cc" id="commit_data_dots">[^<]*<\/tspan><tspan class="value" id="commit_data">[^<]*<\/tspan>/,
    `<tspan class="cc" id="commit_data_dots">${gamesDots}</tspan><tspan class="value" id="commit_data">${stats.gamesCount}</tspan>`
  );

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Actualizado ${filePath}`);
}

async function main() {
  console.log('Obteniendo estadísticas...');
  const stats = await getStats();
  console.log('Estadísticas calculadas:', stats);

  const basePath = path.join(__dirname, '..');
  updateSvgFile(path.join(basePath, 'dark_mode.svg'), stats);
  updateSvgFile(path.join(basePath, 'light_mode.svg'), stats);
  console.log('¡Sincronización completada!');
}

main();
