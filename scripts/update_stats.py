# -*- coding: utf-8 -*-
import os, sys, json, re, urllib.request
from datetime import datetime

def fetch_json(url_str, headers=None):
    if headers is None:
        headers = {}
    headers.setdefault('User-Agent', 'Python-Stats-Sync')
    req = urllib.request.Request(url_str, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Aviso al consultar {url_str}: {e}")
    return None

def get_stats():
    current_year = datetime.now().year
    start_year = 2017
    years_exp = max(1, current_year - start_year)
    age_text = f"+ {years_exp} Años Como Solo Developer"

    # 1. Obtener juegos de EternoDev
    games_count = 5
    games_data = fetch_json("https://raw.githubusercontent.com/paucg06/EternoDev/main/games.json")
    if isinstance(games_data, list) and len(games_data) > 0:
        games_count = len(games_data)

    # 2. Obtener apps escaneando temas/topics de GitHub o fallback
    apps_count = 5
    gh_token = os.environ.get("GITHUB_TOKEN")
    gh_headers = {"Authorization": f"Bearer {gh_token}"} if gh_token else {}

    try:
        user_repos = fetch_json("https://api.github.com/users/paucg06/repos?per_page=100", gh_headers)
        tagged_apps = 0
        if isinstance(user_repos, list):
            app_topics = {"app", "mobile-app", "android-app", "ios-app", "application", "mobile"}
            for repo in user_repos:
                if not repo.get("fork", False):
                    topics = set(t.lower() for t in repo.get("topics", []))
                    if topics & app_topics:
                        tagged_apps += 1
        if tagged_apps > 0:
            apps_count = tagged_apps
    except Exception as e:
        print(f"Aviso al consultar repositorios de GitHub: {e}")

    return {
        "years_exp": years_exp,
        "age_text": age_text,
        "games_count": f"{games_count:02d}",
        "apps_count": f"{apps_count:02d}"
    }

def update_svg_file(file_path, stats):
    if not os.path.exists(file_path):
        return
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Total ancho línea = 59 caracteres monospaced
    # 1. Actividad (12 chars prefix): '. Actividad:'
    age_prefix_len = 12
    age_dots_count = max(2, 59 - age_prefix_len - 1 - len(stats["age_text"]))
    age_dots = " " + ("." * age_dots_count) + " "

    content = re.sub(
        r'<tspan class="cc" id="age_data_dots">[^<]*<\/tspan><tspan class="value" id="age_data">[^<]*<\/tspan>',
        f'<tspan class="cc" id="age_data_dots">{age_dots}</tspan><tspan class="value" id="age_data">{stats["age_text"]}</tspan>',
        content
    )

    # 2. Apps Creadas (15 chars prefix): '. Apps Creadas:'
    apps_prefix_len = 15
    apps_dots_count = max(2, 59 - apps_prefix_len - 1 - len(stats["apps_count"]))
    apps_dots = " " + ("." * apps_dots_count) + " "

    content = re.sub(
        r'<tspan class="cc" id="repo_data_dots">[^<]*<\/tspan><tspan class="value" id="repo_data">[^<]*<\/tspan>',
        f'<tspan class="cc" id="repo_data_dots">{apps_dots}</tspan><tspan class="value" id="repo_data">{stats["apps_count"]}</tspan>',
        content
    )

    # 3. Juegos Creados (17 chars prefix): '. Juegos Creados:'
    games_prefix_len = 17
    games_dots_count = max(2, 59 - games_prefix_len - 1 - len(stats["games_count"]))
    games_dots = " " + ("." * games_dots_count) + " "

    content = re.sub(
        r'<tspan class="cc" id="commit_data_dots">[^<]*<\/tspan><tspan class="value" id="commit_data">[^<]*<\/tspan>',
        f'<tspan class="cc" id="commit_data_dots">{games_dots}</tspan><tspan class="value" id="commit_data">{stats["games_count"]}</tspan>',
        content
    )

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Actualizado: {file_path}")

def main():
    print("Obteniendo estadísticas dinámicas...")
    stats = get_stats()
    print("Estadísticas calculadas:", stats)

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    update_svg_file(os.path.join(base_dir, "dark_mode.svg"), stats)
    update_svg_file(os.path.join(base_dir, "light_mode.svg"), stats)
    print("¡Sincronización completada con éxito!")

if __name__ == "__main__":
    main()
