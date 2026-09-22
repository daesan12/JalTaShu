return {
  -- Effective metres: distance + 30 * total ascent, by default.
  -- This is a distance/ascent trade-off, not an exact lexicographic objective.
  distance_weight = 1.0,
  ascent_weight = 30.0,
  sample_step_m = 15.0,

  -- Optional extra penalty for steep uphill sections; disabled by default.
  -- steepness_weight * sum(sample_distance * max(grade - threshold, 0)^2)
  steepness_weight = 0.0,
  steep_grade_threshold = 0.05,

  -- Missing DEM coverage stops extraction with coordinates in the error.
  -- Do not make unmeasured roads artificially cheap by using zero elevation.
  dem_grid = "dem/elevation.asc",
  dem_metadata = "dem/metadata.lua",
}
