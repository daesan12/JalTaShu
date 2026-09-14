-- 새 로그인: 현재 인증 기록과 토큰 조회 기록을 함께 저장한다.
local record = cjson.decode(ARGV[1])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
local expires = tonumber(record.expiresAtEpochMilli)
if not expires or expires <= now or record.status ~= 'ACTIVE' then return 0 end
if type(record.userId) ~= 'string' or type(record.loginId) ~= 'string'
    or record.loginId == '' then return 0 end
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end

redis.call('SET', KEYS[2], ARGV[1], 'PXAT', string.format('%.0f', expires))
redis.call('SET', KEYS[1], ARGV[1], 'PXAT', string.format('%.0f', expires))
return 1
