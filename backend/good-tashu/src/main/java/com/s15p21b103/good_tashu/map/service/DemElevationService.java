package com.s15p21b103.good_tashu.map.service;

import com.s15p21b103.good_tashu.map.exception.MapException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static com.s15p21b103.good_tashu.map.exception.MapErrorCode.*;

/** Loads the existing OSRM headerless north-to-south raster once, on the first path request. */
@Service
public class DemElevationService {
    private final ObjectMapper mapper;
    private final Path directory;
    private volatile Grid grid;

    public DemElevationService(ObjectMapper mapper,
            @Value("${osrm.dem.directory:osrm/osrm-uphill/dem}") String directory) {
        this.mapper = mapper;
        Path configured = Path.of(directory);
        // Support both repository-root and backend/good-tashu working directories locally.
        this.directory = directory.equals("osrm/osrm-uphill/dem") && !Files.isDirectory(configured)
                ? Path.of("../../osrm/osrm-uphill/dem") : configured;
    }

    public double elevation(double longitude, double latitude) {
        Grid data = getGrid();
        double tolerance = 0.5e-6 + 1e-10;
        if (!Double.isFinite(longitude) || !Double.isFinite(latitude)
                || longitude < data.west - tolerance || longitude > data.east + tolerance
                || latitude < data.south - tolerance || latitude > data.north + tolerance) {
            throw new MapException(DEM_COVERAGE_MISSING);
        }
        double x = (Math.clamp(longitude, data.west, data.east) - data.west)
                / (data.east - data.west) * (data.cols - 1);
        double y = (data.north - Math.clamp(latitude, data.south, data.north))
                / (data.north - data.south) * (data.rows - 1);
        x = Math.clamp(x, 0, data.cols - 1);
        y = Math.clamp(y, 0, data.rows - 1);
        int x0 = (int) x, y0 = (int) y;
        int x1 = Math.min(x0 + 1, data.cols - 1), y1 = Math.min(y0 + 1, data.rows - 1);
        double dx = x - x0, dy = y - y0;
        double top = data.values[y0][x0] * (1 - dx) + data.values[y0][x1] * dx;
        double bottom = data.values[y1][x0] * (1 - dx) + data.values[y1][x1] * dx;
        return (top * (1 - dy) + bottom * dy) / data.scale;
    }

    private Grid getGrid() {
        Grid loaded = grid;
        if (loaded != null) return loaded;
        synchronized (this) {
            if (grid != null) return grid;
            try {
                var meta = mapper.readTree(Files.readString(directory.resolve("metadata.json")));
                int rows = meta.path("nrows").asInt(), cols = meta.path("ncols").asInt();
                double west = meta.path("lon_min").asDouble(Double.NaN);
                double east = meta.path("lon_max").asDouble(Double.NaN);
                double south = meta.path("lat_min").asDouble(Double.NaN);
                double north = meta.path("lat_max").asDouble(Double.NaN);
                double scale = meta.path("value_scale").asDouble(Double.NaN);
                if (!"EPSG:4326".equals(meta.path("crs").asText()) || rows < 2 || cols < 2
                        || !Double.isFinite(scale) || scale <= 0
                        || !Double.isFinite(west) || !Double.isFinite(east)
                        || !Double.isFinite(south) || !Double.isFinite(north)
                        || west >= east || south >= north) {
                    throw new MapException(DEM_DATA_UNAVAILABLE);
                }
                int[][] values = new int[rows][cols];
                try (var reader = Files.newBufferedReader(directory.resolve("elevation.asc"))) {
                    for (int row = 0; row < rows; row++) {
                        String line = reader.readLine();
                        if (line == null) throw new MapException(DEM_DATA_UNAVAILABLE);
                        String[] cells = line.strip().split("\\s+");
                        if (cells.length != cols) throw new MapException(DEM_DATA_UNAVAILABLE);
                        for (int col = 0; col < cols; col++) values[row][col] = Integer.parseInt(cells[col]);
                    }
                    if (reader.lines().anyMatch(line -> !line.isBlank())) {
                        throw new MapException(DEM_DATA_UNAVAILABLE);
                    }
                }
                grid = new Grid(rows, cols, west, east, south, north, scale, values);
                return grid;
            } catch (MapException e) {
                throw e;
            } catch (IOException | RuntimeException e) {
                throw new MapException(DEM_DATA_UNAVAILABLE);
            }
        }
    }

    private record Grid(int rows, int cols, double west, double east, double south,
                        double north, double scale, int[][] values) {}
}
