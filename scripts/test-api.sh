#!/usr/bin/env bash
# ============================================================
# 西兰卡普后端 E2E 验收脚本（对应代办清单 1.10 / 规格书 AT-02/05/07/09/10/11/13）
# 用法：bash scripts/test-api.sh
# 说明：自动重启本地服务；结束后保持服务运行；输出 PASS/FAIL 汇总
# ============================================================
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT/scripts/use-node.sh" || exit 1
SERVER_DIR="$ROOT/server"
API=http://127.0.0.1:3000
TMP="$SERVER_DIR/.test-tmp"
mkdir -p "$TMP"

ADMIN_PW="$(grep '^ADMIN_PASSWORD=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d '\r')"
ADMIN_PW="${ADMIN_PW:-xilankapu-demo}"

PASS=0; FAIL=0
say()   { printf '\n== %s ==\n' "$1"; }
ok()    { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()   { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
# check <用例名> <期望包含子串> <实际输出>
check() {
  local name="$1" want="$2" got="$3"
  if [[ "$got" == *"$want"* ]]; then ok "$name"; else
    bad "$name（期望包含: $want）"; echo "    实际: ${got:0:260}"
  fi
}
kill_server() {
  local pid
  pid="$(netstat -ano | grep ':3000.*LISTENING' | awk '{print $5}' | head -1)"
  [ -n "$pid" ] && taskkill //PID "$pid" //F >/dev/null 2>&1
  sleep 1
}
start_server() {
  (cd "$SERVER_DIR" && node src/index.js > "$TMP/server.log" 2>&1 &)
  sleep 4
}

# ---------- 0. 启动 ----------
say "服务启动与健康检查"
kill_server; start_server
check "GET /api/health" '"status":"ok"' "$(curl -s --max-time 15 $API/api/health)"

# ---------- 1. 鉴权（AT-02） ----------
say "管理员鉴权"
check "错误密码 → AUTH_INVALID_CREDENTIALS" 'AUTH_INVALID_CREDENTIALS' \
  "$(curl -s --max-time 15 -X POST $API/api/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"nope"}')"
check "无 token 访问管理接口 → 401" '"success":false' "$(curl -s --max-time 15 $API/api/admin/providers)"
LOGIN=$(curl -s --max-time 15 -X POST $API/api/admin/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PW\"}")
TOKEN=$(echo "$LOGIN" | sed -E 's/.*"token":"([^"]+)".*/\1/')
if [[ "$TOKEN" == *'{'* || -z "$TOKEN" ]]; then bad "登录获取 token"; echo "    实际: ${LOGIN:0:200}"; else ok "登录获取 token"; fi
AUTH="Authorization: Bearer $TOKEN"

# ---------- 2. Provider 配置与切换（AT-03） ----------
say "Provider 配置"
PROV=$(curl -s --max-time 15 -X POST $API/api/admin/providers -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"验收Mock","adapterType":"mock","modelId":"mock-xilankapu"}')
check "新增 mock provider" '"adapterType":"mock"' "$PROV"
PID=$(echo "$PROV" | sed -E 's/.*"id":"(prov-[^"]+)".*/\1/')
LIST=$(curl -s --max-time 15 $API/api/admin/providers -H "$AUTH")
check "密钥只回 hasApiKey，不回明文" '"hasApiKey":false' "$LIST"
check "激活 provider" '"active":true' "$(curl -s --max-time 15 -X POST $API/api/admin/providers/$PID/activate -H "$AUTH")"
BADPROV=$(curl -s --max-time 15 -X POST $API/api/admin/providers -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"非法","adapterType":"openai_compatible","baseUrl":"http://127.0.0.1:9","modelId":"x","apiKey":"k"}')
check "SSRF：私网地址被拒" '"success":false' "$BADPROV"

# ---------- 3. 生成链路（AT-05，mock 真实走适配器） ----------
say "生成任务（mock provider）"
GEN=$(curl -s --max-time 15 -X POST $API/api/generations -H 'Content-Type: application/json' \
  -d '{"mode":"text_to_image","prompt":"验收脚本：解构四十八勾纹样，几何重组，新中式服装印花","style":"new_chinese","size":"1024x1024"}')
check "提交任务 queued" '"status":"queued"' "$GEN"
JOBID=$(echo "$GEN" | sed -E 's/.*"jobId":"(job-[^"]+)".*/\1/')
for i in $(seq 1 30); do
  POLL=$(curl -s --max-time 15 $API/api/generations/$JOBID)
  [[ "$POLL" == *'"succeeded"'* || "$POLL" == *'"failed"'* ]] && break
  sleep 1
done
check "轮询至 succeeded" '"status":"succeeded"' "$POLL"
check "返回 imageUrl" '/api/images/generated/' "$POLL"
IMG_URL=$(echo "$POLL" | sed -E 's#.*"imageUrl":"([^"]+)".*#\1#')

# ---------- 4. 图片落盘可访问 ----------
say "生成图片访问"
IMG_CODE=$(cd "$TMP" && curl -s --max-time 15 -o gen.png -w '%{http_code}' "$API$IMG_URL")
check "图片 HTTP 200" '200' "$IMG_CODE"
MAGIC="$(od -A n -t x1 -N 4 "$TMP/gen.png" 2>/dev/null | tr -d ' \n')"
check "PNG 魔数 89504e47" '89504e47' "$MAGIC"
TRAVERSAL=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' "$API/api/images/generated/..%2f..%2f.env")
check "路径穿越被拒（非200）" '404' "$TRAVERSAL"

# ---------- 5. 订单链路（AT-09/AT-11） ----------
say "模拟订单"
check "未勾隐私 → 拦截" '隐私' "$(curl -s --max-time 15 -X POST $API/api/orders -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"验收员\",\"contact\":\"13800000000\",\"garmentTemplateId\":\"hoodie-001\",\"size\":\"L\",\"quantity\":1,\"generationJobId\":\"$JOBID\",\"privacyAccepted\":false}")"
ORD=$(curl -s --max-time 15 -X POST $API/api/orders -H 'Content-Type: application/json' \
  -d "{\"customerName\":\"验收员\",\"contact\":\"13800000000\",\"garmentTemplateId\":\"hoodie-001\",\"size\":\"L\",\"quantity\":1,\"generationJobId\":\"$JOBID\",\"placement\":{\"scale\":1,\"offsetX\":0,\"offsetY\":0,\"opacity\":1},\"privacyAccepted\":true}")
check "提交成功返回订单号 XLKP-" 'XLKP-' "$ORD"
BADJOB=$(curl -s --max-time 15 -X POST $API/api/orders -H 'Content-Type: application/json' \
  -d '{"customerName":"验收员","contact":"138","garmentTemplateId":"hoodie-001","size":"L","quantity":1,"generationJobId":"job-not-exist","privacyAccepted":true}')
check "非法 generationJobId → 拒绝" '不存在' "$BADJOB"

# ---------- 6. 管理端查询与流转 ----------
say "管理端"
OLIST=$(curl -s --max-time 15 "$API/api/admin/orders" -H "$AUTH")
check "订单列表含刚提交订单" 'XLKP-' "$OLIST"
ORDER_NO=$(echo "$ORD" | sed -E 's/.*"orderNo":"([^"]+)".*/\1/')
OLIST2=$(curl -s --max-time 15 "$API/api/admin/orders?keyword=$ORDER_NO" -H "$AUTH")
OID=$(echo "$OLIST2" | sed -E 's/.*?"id":"(ord-[^"]+)".*/\1/')
if [[ "$OID" != ord-* ]]; then bad "按订单号定位订单 id"; echo "    实际: ${OLIST2:0:200}"; else ok "按订单号定位订单 id"; fi
check "订单状态流转 pending→confirming" '"status":"confirming"' \
  "$(curl -s --max-time 15 -X PATCH $API/api/admin/orders/$OID/status -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"confirming"}')"
check "订单状态流转 confirming→completed" '"status":"completed"' \
  "$(curl -s --max-time 15 -X PATCH $API/api/admin/orders/$OID/status -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"completed"}')"
check "状态回退 completed→confirming 被拒" '单向流转' \
  "$(curl -s --max-time 15 -X PATCH $API/api/admin/orders/$OID/status -H "$AUTH" -H 'Content-Type: application/json' -d '{"status":"confirming"}')"
GLIST=$(curl -s --max-time 15 "$API/api/admin/generations?status=succeeded" -H "$AUTH")
check "生成记录筛选 succeeded（且不含 failed）" '"status":"succeeded"' "$GLIST"
case "$GLIST" in *'"status":"failed"'*) bad "succeeded 筛选混入 failed 记录";; *) ok "succeeded 筛选无 failed 混入";; esac

# ---------- 7. 上传校验 ----------
say "参考图上传"
UP=$(cd "$TMP" && curl -s --max-time 15 -X POST $API/api/uploads/reference -F 'file=@gen.png;type=image/png')
check "PNG 上传成功" 'img-' "$UP"
printf 'not an image' > "$TMP/fake.txt"
UPBAD=$(cd "$TMP" && curl -s --max-time 15 -X POST $API/api/uploads/reference -F 'file=@fake.txt;type=text/plain')
check "txt 上传被拒 UPLOAD_REJECTED" 'UPLOAD_REJECTED' "$UPBAD"

# ---------- 8. 登出与会话 ----------
say "登出"
curl -s --max-time 15 -X POST $API/api/admin/logout -H "$AUTH" > /dev/null
check "登出后旧 token 401" '401' "$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' $API/api/admin/providers -H "$AUTH")"
TOKEN=$(curl -s --max-time 15 -X POST $API/api/admin/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PW\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')
AUTH="Authorization: Bearer $TOKEN"

# ---------- 9. 登录限试 ----------
say "登录限试（5 次失败锁定）"
LOCKED=''
for i in 1 2 3 4 5 6; do
  R=$(curl -s --max-time 15 -X POST $API/api/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"bad"}')
  [[ "$R" == *'AUTH_LOCKED'* ]] && LOCKED='yes' && break
done
check "连续失败触发 AUTH_LOCKED" 'yes' "${LOCKED:-no}"

# ---------- 10. 重启持久化（AT-10；顺带验证锁定为内存态，重启即清） ----------
say "重启持久化"
kill_server; start_server
TOKEN=$(curl -s --max-time 15 -X POST $API/api/admin/login -H 'Content-Type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"$ADMIN_PW\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')
AUTH="Authorization: Bearer $TOKEN"
if [[ "$TOKEN" == *'{'* || -z "$TOKEN" ]]; then bad "重启后可重新登录（锁定已清）"; else ok "重启后可重新登录（锁定已清）"; fi
check "重启后订单仍在" 'XLKP-' "$(curl -s --max-time 15 "$API/api/admin/orders" -H "$AUTH")"
check "重启后生成记录仍在" 'succeeded' "$(curl -s --max-time 15 "$API/api/admin/generations?status=succeeded" -H "$AUTH")"
IMG_CODE2=$(curl -s --max-time 15 -o /dev/null -w '%{http_code}' "$API$IMG_URL")
check "重启后生成图片仍可访问" '200' "$IMG_CODE2"

# ---------- 汇总 ----------
echo ""
echo "=========================================="
echo "验收结果：PASS=$PASS  FAIL=$FAIL"
echo "=========================================="
[ "$FAIL" -eq 0 ] && echo "全部通过 ✅  服务保持运行：$API/api/health" || { echo "存在失败项 ❌ 日志：$TMP/server.log"; exit 1; }
