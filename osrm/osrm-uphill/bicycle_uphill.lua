-- OSRM profile API 4. Checked against the v5.27.1 API/source.
-- Reuse bicycle.lua and lib/ from THE SAME OSRM VERSION as your executable.
api_version = 4

local source = debug.getinfo(1, "S").source
local directory = source:sub(1, 1) == "@" and source:sub(2):match("^(.*[/\\])") or nil
directory = directory or "./"
local base_dir = os.getenv("OSRM_BASE_PROFILES") or "/opt"
package.path = base_dir .. "/?.lua;" .. base_dir .. "/?/init.lua;" .. package.path

local base = dofile(base_dir .. "/bicycle.lua")
assert(api_version == 4, "The base bicycle profile must use OSRM profile API 4")
local cost = dofile(directory .. "dem_cost.lua")

local function local_path(path)
  if path:sub(1, 1) == "/" or path:match("^%a:[/\\]") then return path end
  return directory .. path
end

local function setup()
  local profile = base.setup()
  local config = dofile(directory .. "config.lua")
  cost.validate(config)
  local meta = dofile(local_path(config.dem_metadata))
  profile.properties.weight_name = "uphill"
  profile.properties.weight_precision = 2
  profile.properties.force_split_edges = true
  profile.use_public_transport = false
  profile.uphill = config
  profile.dem_metadata = meta
  profile.dem_source = raster:load(local_path(config.dem_grid),
      meta.lon_min, meta.lon_max, meta.lat_min, meta.lat_max, meta.nrows, meta.ncols)
  return profile
end

local function process_way(profile, way, result, relations)
  -- Terrain elevation is not meaningful for ferry / public transport travel.
  local route = way:get_value_by_key("route")
  if route == "ferry" or route == "shuttle_train" then return end
  base.process_way(profile, way, result, relations)
  -- Seed distance weights; process_segment replaces them with uphill costs.
  -- Keep base modes, speed estimates, one-way/access rules and guidance.
  result.weight = -1
  if result.forward_mode ~= mode.inaccessible and result.forward_speed > 0 then
    result.forward_rate = 1
  end
  if result.backward_mode ~= mode.inaccessible and result.backward_speed > 0 then
    result.backward_rate = 1
  end
end

local function process_turn(profile, turn)
  if base.process_turn then base.process_turn(profile, turn) end
  -- The objective has distance/ascent units, not seconds. Turn delays stay
  -- in duration; adding turn costs here would change the stated objective.
  turn.weight = 0
end

local function process_segment(profile, segment)
  segment.weight = cost.evaluate(profile, segment)
  -- duration remains the base bicycle ETA estimate (not grade-adjusted).
end

local callbacks = {}
for key, value in pairs(base) do callbacks[key] = value end
callbacks.setup = setup
callbacks.process_way = process_way
callbacks.process_turn = process_turn
callbacks.process_segment = process_segment
return callbacks
