-- Pure scoring callback plus OSRM raster lookup. No request-time DEM I/O.
local M = {}

local function finite(value)
  return type(value) == "number" and value == value
      and value ~= math.huge and value ~= -math.huge
end

function M.validate(config)
  for _, key in ipairs({"distance_weight", "ascent_weight", "sample_step_m",
                        "steepness_weight", "steep_grade_threshold"}) do
    assert(finite(config[key]) and config[key] >= 0, key .. " must be finite and non-negative")
  end
  assert(config.distance_weight > 0, "distance_weight must be positive; pure-ascent routing is not implemented")
  assert(config.sample_step_m > 0, "sample_step_m must be positive")
end

function M.elevation(profile, lon, lat)
  local meta = profile.dem_metadata
  -- OSRM v5.27.1 rounds OSM coordinates to 1e-6 degrees. A covered
  -- endpoint may move at most half a unit beyond a DEM sample centre.
  -- Clamp only that rounding error (plus floating-point noise), not real gaps.
  local tolerance = 0.5e-6 + 1e-10
  if not finite(lon) or not finite(lat)
      or lon < meta.lon_min - tolerance or lon > meta.lon_max + tolerance
      or lat < meta.lat_min - tolerance or lat > meta.lat_max + tolerance then
    error(string.format("DEM coverage missing at lon=%.7f lat=%.7f; use a larger DEM or a covered OSM extract", lon, lat))
  end
  lon = math.max(meta.lon_min, math.min(meta.lon_max, lon))
  lat = math.max(meta.lat_min, math.min(meta.lat_max, lat))
  local result = raster:interpolate(profile.dem_source, lon, lat)
  if result.datum == result.invalid_data() or not finite(result.datum) then
    error(string.format("Invalid DEM sample at lon=%.7f lat=%.7f", lon, lat))
  end
  return result.datum / meta.value_scale
end

function M.evaluate(profile, segment)
  local config = profile.uphill
  local distance = segment.distance
  assert(finite(distance) and distance >= 0, "Invalid segment distance")
  if distance == 0 then return 0.01, 0, 0 end
  local steps = math.max(1, math.ceil(distance / config.sample_step_m))
  local ds = distance / steps
  local lon0, lat0 = segment.source.lon, segment.source.lat
  local lon1, lat1 = segment.target.lon, segment.target.lat
  local previous = M.elevation(profile, lon0, lat0)
  local ascent, steepness = 0, 0
  for i = 1, steps do
    local t = i / steps
    local lon, lat = lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t
    local current = M.elevation(profile, lon, lat)
    local rise = math.max(0, current - previous)
    ascent = ascent + rise
    local excess_grade = math.max(0, rise / ds - config.steep_grade_threshold)
    steepness = steepness + ds * excess_grade * excess_grade
    previous = current
  end
  local weight = config.distance_weight * distance
               + config.ascent_weight * ascent
               + config.steepness_weight * steepness
  assert(finite(weight), "Non-finite routing weight")
  return math.max(weight, 0.01), ascent, steepness
end

return M
