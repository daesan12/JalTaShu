#!/usr/bin/env python3
"""Convert a DEM GeoTIFF to the headerless integer raster OSRM expects."""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.warp import Resampling, calculate_default_transform, reproject


def convert(input_path, output_dir, vertical_scale=1.0, smooth_sigma=0.0):
    input_path, output_dir = Path(input_path), Path(output_dir)
    if not np.isfinite(vertical_scale) or vertical_scale <= 0:
        raise ValueError("vertical_scale must be a positive conversion factor to metres")
    if not np.isfinite(smooth_sigma) or smooth_sigma < 0:
        raise ValueError("smooth_sigma must be finite and non-negative")
    with rasterio.open(input_path) as src:
        if src.crs is None or src.count != 1:
            raise ValueError("Expected a single-band DEM with an explicit CRS")
        original = src.read(1, masked=True).astype(np.float64).filled(np.nan)
        original = (original * src.scales[0] + src.offsets[0]) * vertical_scale
        src_transform = src.transform
        source_info = {
            "filename": input_path.name,
            "sha256": hashlib.sha256(input_path.read_bytes()).hexdigest(),
            "crs": str(src.crs), "width": src.width, "height": src.height,
            "bounds": list(src.bounds), "resolution": list(src.res),
            "nodata": src.nodata, "band_unit_metadata": src.units[0],
            "band_scale": src.scales[0], "band_offset": src.offsets[0],
            "vertical_scale_to_metres": vertical_scale,
        }
        north_up = (src_transform.b == 0 and src_transform.d == 0
                    and src_transform.a > 0 and src_transform.e < 0)
        if src.crs.to_epsg() == 4326 and north_up:
            data, transform = original, src_transform
        else:
            transform, width, height = calculate_default_transform(
                src.crs, "EPSG:4326", src.width, src.height, *src.bounds)
            data = np.full((height, width), np.nan, dtype=np.float64)
            reproject(original, data, src_transform=src_transform, src_crs=src.crs,
                      src_nodata=np.nan, dst_transform=transform,
                      dst_crs="EPSG:4326", dst_nodata=np.nan,
                      resampling=Resampling.bilinear)
    invalid_count = int(np.count_nonzero(~np.isfinite(data)))
    if invalid_count:
        raise ValueError(
            f"DEM has {invalid_count} missing pixels after conversion. "
            "Crop to a fully covered area or explicitly repair the DEM first. "
            "Missing heights must not be treated as zero or interpolated as valid data.")
    if smooth_sigma:
        from scipy.ndimage import gaussian_filter
        data = gaussian_filter(data, sigma=smooth_sigma, mode="nearest")
    rows, cols = data.shape
    if rows < 2 or cols < 2:
        raise ValueError("OSRM raster requires at least two rows and columns")
    # OSRM bounds refer to FIRST/LAST SAMPLE CENTRES, not outer pixel bounds.
    lon_min, lat_max = transform * (0.5, 0.5)
    lon_max, lat_min = transform * (cols - 0.5, rows - 0.5)
    scale = 100  # centimetres reduce truncation during OSRM's integer interpolation
    encoded = np.rint(data * scale)
    if encoded.min() < -1_000_000_000 or encoded.max() > 1_000_000_000:
        raise ValueError("Elevation overflows the supported integer raster range")
    metadata = {
        "format": "headerless signed integers; north-to-south rows, west-to-east columns",
        "crs": "EPSG:4326", "nrows": rows, "ncols": cols,
        "lon_min": lon_min, "lon_max": lon_max,
        "lat_min": lat_min, "lat_max": lat_max,
        "value_scale": scale, "elevation_unit": "metre (see source unit metadata)",
        "smooth_sigma_pixels": smooth_sigma,
        "elevation_min_m": float(data.min()), "elevation_max_m": float(data.max()),
        "invalid_pixels": invalid_count, "source": source_info,
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    np.savetxt(output_dir / "elevation.asc", encoded.astype(np.int32), fmt="%d")
    (output_dir / "metadata.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    fields = ["nrows", "ncols", "lon_min", "lon_max", "lat_min", "lat_max", "value_scale"]
    lua = "return {\n" + "".join(f"  {k} = {metadata[k]!r},\n" for k in fields) + "}\n"
    (output_dir / "metadata.lua").write_text(lua, encoding="utf-8")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--vertical-scale", type=float, default=1.0,
                        help="factor converting source elevation units to metres (default: 1)")
    parser.add_argument("--smooth-sigma", type=float, default=0.0,
                        help="optional Gaussian sigma in pixels; requires scipy; default: no smoothing")
    args = parser.parse_args()
    print(json.dumps(convert(args.input, args.output_dir, args.vertical_scale,
                             args.smooth_sigma), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
