# 触发 Render 部署：Deploy Hook 网址存在系统凭据管理器 keyring("render_deploy_hook", "avalon-online")，不进仓库
import keyring, urllib.request, json
url = keyring.get_password('render_deploy_hook', 'avalon-online')
if not url:
    raise SystemExit('凭据管理器里没有 render_deploy_hook/avalon-online')
with urllib.request.urlopen(urllib.request.Request(url, method='POST'), timeout=30) as r:
    print('Render 部署已触发', r.status, json.loads(r.read() or b'{}').get('deploy', {}).get('id', ''))
