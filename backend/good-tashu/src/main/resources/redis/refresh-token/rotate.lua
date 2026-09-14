-- 모든 검사를 쓰기 전에 수행한다. Lua 실행 중 다른 명령이 끼어들지 않지만 오류 시 rollback은 없다.
local userRaw = redis.call('GET', KEYS[1])
local tokenRaw = redis.call('GET', KEYS[2])
if not userRaw or not tokenRaw then return 0 end
local user = cjson.decode(userRaw)
local token = cjson.decode(tokenRaw)
local nextToken = cjson.decode(ARGV[1])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

-- 과거 로그인 토큰으로 현재 새 로그인을 폐기하지 않는다.
if not token.loginId or not user.loginId
    or token.tokenHash ~= ARGV[2] or token.userId ~= user.userId
    or token.loginId ~= user.loginId or user.status ~= 'ACTIVE'
    or token.expiresAtEpochMilli <= now or user.expiresAtEpochMilli <= now then
    return 0
end

-- 같은 로그인에서 소비된 토큰 재사용: 현재 인증 기록을 폐기한다.
if token.status == 'USED' then
    redis.call('DEL', KEYS[1])
    return -1
end

if token.status ~= 'ACTIVE' or user.tokenHash ~= token.tokenHash
    or user.authVersion ~= token.authVersion then return 0 end
if nextToken.userId ~= user.userId or nextToken.loginId ~= user.loginId
    or nextToken.expiresAtEpochMilli ~= user.expiresAtEpochMilli
    or nextToken.status ~= 'ACTIVE' or nextToken.authVersion == user.authVersion
    or nextToken.tokenHash == token.tokenHash then return 0 end
if redis.call('EXISTS', KEYS[3]) == 1 then return 0 end

-- 로그인 절대 만료까지 소비 이력을 남긴다. 회전으로 만료를 연장하지 않는다.
token.status = 'USED'
local usedJson = cjson.encode(token)
local expires = string.format('%.0f', user.expiresAtEpochMilli)
redis.call('SET', KEYS[3], ARGV[1], 'PXAT', expires)
redis.call('SET', KEYS[2], usedJson, 'PXAT', expires)
redis.call('SET', KEYS[1], ARGV[1], 'PXAT', expires)
return 1
