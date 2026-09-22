"""Tests the real Lua callback with a raster adapter, not the native OSRM engine."""
import math
import json
import os
from pathlib import Path
import tempfile
import unittest

from lupa import LuaRuntime, LuaError
import numpy as np
import rasterio
from rasterio.transform import from_origin

from prepare_dem import convert

ROOT = Path(__file__).resolve().parent


class CostTests(unittest.TestCase):
    def setUp(self):
        self.lua = LuaRuntime(unpack_returned_tuples=True)
        self.cost = self.lua.execute((ROOT / "dem_cost.lua").read_text())
        self.config = self.lua.execute((ROOT / "config.lua").read_text())
        self.meta = self.lua.table_from(dict(lon_min=0, lon_max=1, lat_min=0,
                                             lat_max=1, value_scale=100))
        self.profile = self.lua.table_from(dict(uphill=self.config,
                                                dem_metadata=self.meta, dem_source=0))
        self.set_surface(lambda x, y: 100)

    def set_surface(self, height_function):
        def interpolate(_raster, _source, lon, lat):
            return self.lua.table_from(dict(datum=int(height_function(lon, lat) * 100),
                                             invalid_data=lambda: 2147483647))
        self.lua.globals().raster = self.lua.table_from(dict(interpolate=interpolate))

    def segment(self, distance, reverse=False):
        return self.lua.table_from(dict(distance=distance, duration=123,
            source=self.lua.table_from(dict(lon=1 if reverse else 0, lat=0.5)),
            target=self.lua.table_from(dict(lon=0 if reverse else 1, lat=0.5))))

    def test_uphill_and_downhill_have_different_costs(self):
        self.set_surface(lambda x, y: 100 + 20 * x)
        weight, ascent, _ = self.cost.evaluate(self.profile, self.segment(240))
        self.assertAlmostEqual(ascent, 20)
        self.assertAlmostEqual(weight, 840)
        reverse_weight, reverse_ascent, _ = self.cost.evaluate(self.profile, self.segment(240, True))
        self.assertAlmostEqual(reverse_ascent, 0)
        self.assertAlmostEqual(reverse_weight, 240)

    def test_middle_hill_is_counted_when_endpoints_have_equal_elevation(self):
        self.set_surface(lambda x, y: 100 + 20 * (1 - abs(2*x - 1)))
        weight, ascent, _ = self.cost.evaluate(self.profile, self.segment(300))
        self.assertAlmostEqual(ascent, 20)
        self.assertAlmostEqual(weight, 900)

    def test_flat_detour_beats_short_hilly_route(self):
        self.set_surface(lambda x, y: 100 + 20 * (1 - abs(2*x - 1)))
        hill_cost = self.cost.evaluate(self.profile, self.segment(300))[0]
        self.set_surface(lambda x, y: 100)
        flat_cost = self.cost.evaluate(self.profile, self.segment(700))[0]
        self.assertGreater(hill_cost, flat_cost)
        # Reducing the user preference reverses the choice on the same inputs.
        self.config.ascent_weight = 5
        self.set_surface(lambda x, y: 100 + 20 * (1 - abs(2*x - 1)))
        self.assertLess(self.cost.evaluate(self.profile, self.segment(300))[0], flat_cost)

    def test_optional_steep_grade_penalty(self):
        self.config.steepness_weight = 100
        self.set_surface(lambda x, y: 100 + 10 * x)
        short = self.cost.evaluate(self.profile, self.segment(100))
        gentle = self.cost.evaluate(self.profile, self.segment(200))
        self.assertGreater(short[2], gentle[2])
        self.assertAlmostEqual(short[1], gentle[1])

    def test_missing_coverage_raises_instead_of_using_zero_height(self):
        segment = self.segment(100)
        segment.target.lon = 2
        with self.assertRaisesRegex(LuaError, "DEM coverage missing"):
            self.cost.evaluate(self.profile, segment)

    def test_osrm_coordinate_rounding_at_actual_dem_boundary(self):
        meta = json.loads((ROOT / "dem/metadata.json").read_text())
        self.profile.dem_metadata = self.lua.table_from(meta)
        sampled = []
        def height(lon, lat):
            self.assertTrue(meta["lon_min"] <= lon <= meta["lon_max"])
            self.assertTrue(meta["lat_min"] <= lat <= meta["lat_max"])
            sampled.append((lon, lat))
            return 100
        self.set_surface(height)
        self.assertEqual(self.cost.elevation(self.profile, 127.2300000, 36.5095740), 100)
        for lon in (meta["lon_min"], meta["lon_max"]):
            for lat in (meta["lat_min"], meta["lat_max"]):
                self.assertEqual(self.cost.elevation(self.profile, round(lon, 6), round(lat, 6)), 100)
        self.assertEqual(len(sampled), 5)

    def test_submetre_gaps_beyond_rounding_tolerance_still_fail(self):
        for lon, lat in [(-0.6e-6, 0.5), (1 + 0.6e-6, 0.5),
                         (0.5, -0.6e-6), (0.5, 1 + 0.6e-6)]:
            with self.subTest(lon=lon, lat=lat):
                with self.assertRaisesRegex(LuaError, "DEM coverage missing"):
                    self.cost.elevation(self.profile, lon, lat)

    def test_pure_ascent_is_explicitly_rejected(self):
        self.config.distance_weight = 0
        with self.assertRaisesRegex(LuaError, "pure-ascent"):
            self.cost.validate(self.config)


class ConversionTests(unittest.TestCase):
    def test_pixel_centres_orientation_scale_and_source_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "dem.tif"
            with rasterio.open(path, "w", driver="GTiff", height=2, width=3,
                               count=1, dtype="int16", crs="EPSG:4326",
                               transform=from_origin(127, 37, 0.01, 0.01)) as dst:
                dst.write(np.array([[10, 20, 30], [40, 50, 60]], dtype=np.int16), 1)
            meta = convert(path, Path(temp) / "out")
            self.assertAlmostEqual(meta["lon_min"], 127.005)
            self.assertAlmostEqual(meta["lon_max"], 127.025)
            self.assertAlmostEqual(meta["lat_max"], 36.995)
            self.assertAlmostEqual(meta["lat_min"], 36.985)
            np.testing.assert_array_equal(np.loadtxt(Path(temp) / "out/elevation.asc"),
                                          [[1000, 2000, 3000], [4000, 5000, 6000]])

    def test_nodata_is_rejected_before_export(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "dem.tif"
            with rasterio.open(path, "w", driver="GTiff", height=2, width=2,
                               count=1, dtype="int16", crs="EPSG:4326", nodata=-9999,
                               transform=from_origin(127, 37, 0.01, 0.01)) as dst:
                dst.write(np.array([[10, -9999], [20, 30]], dtype=np.int16), 1)
            with self.assertRaisesRegex(ValueError, "missing pixels"):
                convert(path, Path(temp) / "out")

    def test_actual_daejeon_dem_is_preserved_without_resampling(self):
        with rasterio.open(ROOT / "dem/daejeon-dem.tif") as src:
            original = src.read(1)
        grid = np.loadtxt(ROOT / "dem/elevation.asc", dtype=np.int32)
        self.assertEqual(grid.shape, original.shape)
        np.testing.assert_array_equal(grid, original.astype(np.int32) * 100)


class WrapperTests(unittest.TestCase):
    def test_wrapper_configures_directional_weights_and_preserves_duration(self):
        # An explicit bicycle API stub isolates our wrapper; it is not OSRM.
        lua = LuaRuntime(unpack_returned_tuples=True)
        lua.globals().mode = lua.table_from(dict(inaccessible=0, cycling=1))
        root = str(ROOT).replace("\\", "/")
        lua.execute('''
          local real_dofile = dofile
          dofile = function(path)
            if path:match("/bicycle.lua$") then
              return {
                setup = function() return { properties = {} } end,
                process_way = function(p, w, r)
                  r.forward_mode = 1; r.backward_mode = 1
                  r.forward_speed = 15; r.backward_speed = 15
                end,
                process_turn = function(p, t) t.duration = 7 end,
                process_node = function() end
              }
            end
            return real_dofile(path)
          end
          raster = {
            load = function(self, ...) return 0 end,
            interpolate = function(self, id, lon, lat)
              return {datum = 10000, invalid_data = function() return 2147483647 end}
            end
          }
        ''')
        callbacks = lua.eval("dofile")(root + "/bicycle_uphill.lua")
        profile = callbacks.setup()
        self.assertTrue(profile.properties.force_split_edges)
        self.assertEqual(profile.properties.weight_name, "uphill")
        segment = lua.table_from(dict(distance=100, duration=24,
            source=lua.table_from(dict(lon=127.4, lat=36.35)),
            target=lua.table_from(dict(lon=127.401, lat=36.35))))
        callbacks.process_segment(profile, segment)
        self.assertEqual(segment.duration, 24)
        self.assertEqual(segment.weight, 100)
        turn = lua.table_from(dict(duration=0, weight=0))
        callbacks.process_turn(profile, turn)
        self.assertEqual(turn.duration, 7)
        self.assertEqual(turn.weight, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
