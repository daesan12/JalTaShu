local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local current = cjson.decode(raw)
if current[ARGV[1]] ~= ARGV[2] then return 0 end
-- 이력은 TTL까지 보존한다. 현재 인증 기록이 없으면 어떤 RT도 갱신할 수 없다.
return redis.call('DEL', KEYS[1])
