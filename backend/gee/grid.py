"""
gee/grid.py
-----------
Generates a fishnet (regular grid) of polygon cells over a bounding box.

The output is pure-Python dicts with GeoJSON geometries — no numpy or
shapely objects escape this module, so Supabase serialisation is safe.
"""

import math
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

# Earth radius used for approximate degree ↔ metre conversion
_EARTH_RADIUS_M = 6_371_000


def _metres_to_degrees_lat(metres: float) -> float:
    """Convert a distance in metres to an approximate latitude delta (°)."""
    return metres / (_EARTH_RADIUS_M * math.pi / 180)


def _metres_to_degrees_lon(metres: float, lat_degrees: float) -> float:
    """Convert a distance in metres to an approximate longitude delta (°) at a given latitude."""
    return metres / (_EARTH_RADIUS_M * math.pi / 180 * math.cos(math.radians(lat_degrees)))


def create_fishnet(bbox: dict, cell_size_m: float = 500, max_cells: int = 50) -> List[Dict]:
    """
    Divide the bounding box into a regular grid of approximately `cell_size_m` metre cells.

    If the resulting grid would exceed `max_cells`, the cell size is automatically
    scaled up so the total stays at or below the cap.  This keeps GEE API call
    counts predictable regardless of city size.

    Parameters
    ----------
    bbox : dict
        Keys: west, south, east, north  (decimal degrees).
    cell_size_m : float
        Minimum (ideal) side length of each cell in metres.  Default 500 m.
    max_cells : int
        Hard cap on the total number of grid cells.  Default 50.

    Returns
    -------
    List of dicts, each with:
        - "name"          : str  — zero-padded cell index, e.g. "ward_0042"
        - "boundary_json" : dict — GeoJSON Polygon geometry
        - "_bbox"         : dict — west/south/east/north for GEE requests
    """
    west  = float(bbox["west"])
    south = float(bbox["south"])
    east  = float(bbox["east"])
    north = float(bbox["north"])

    centre_lat = (south + north) / 2.0

    # ── Auto-scale cell size to respect max_cells cap ────────────────────────
    # Estimate how many rows/cols a square grid of `cell_size_m` would produce,
    # then scale up uniformly until total cells ≤ max_cells.
    lat_step = _metres_to_degrees_lat(cell_size_m)
    lon_step = _metres_to_degrees_lon(cell_size_m, centre_lat)

    approx_rows = math.ceil((north - south) / lat_step)
    approx_cols = math.ceil((east  - west)  / lon_step)
    approx_total = approx_rows * approx_cols

    if approx_total > max_cells:
        # Scale factor to shrink the grid to max_cells cells.
        # New total ≈ (rows/scale) × (cols/scale) = approx_total / scale²
        # Solving: scale² = approx_total / max_cells
        scale     = math.sqrt(approx_total / max_cells)
        cell_size_m = cell_size_m * scale
        lat_step  = _metres_to_degrees_lat(cell_size_m)
        lon_step  = _metres_to_degrees_lon(cell_size_m, centre_lat)
        logger.info(
            "max_cells=%d cap triggered — cell size scaled from original to %.0f m",
            max_cells, cell_size_m,
        )

    cells: List[Dict] = []
    row = 0
    y = south
    while y < north:
        col = 0
        x = west
        while x < east:
            x0 = x
            y0 = y
            x1 = min(x + lon_step, east)
            y1 = min(y + lat_step, north)

            # GeoJSON Polygon — coordinates are plain Python floats
            polygon: Dict = {
                "type": "Polygon",
                "coordinates": [[
                    [float(x0), float(y0)],
                    [float(x1), float(y0)],
                    [float(x1), float(y1)],
                    [float(x0), float(y1)],
                    [float(x0), float(y0)],  # close the ring
                ]],
            }

            cell_index = row * 10_000 + col   # unique per bbox
            name = f"ward_{cell_index:06d}"

            cells.append({
                "name":          name,
                "boundary_json": polygon,
                # Convenience bbox for sub-ward GEE requests
                "_bbox": {
                    "west":  float(x0),
                    "south": float(y0),
                    "east":  float(x1),
                    "north": float(y1),
                },
            })

            x += lon_step
            col += 1
        y += lat_step
        row += 1

    logger.info("Fishnet created: %d cells for bbox %s (effective cell_size=%.0fm)", len(cells), bbox, cell_size_m)
    return cells
