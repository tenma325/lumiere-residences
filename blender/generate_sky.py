"""Procedurally generate photorealistic equirectangular sky images using Pillow.
Full control over gradient, sun disc, bloom, and color — no Blender dependency.

Usage:
  python blender/generate_sky.py

Output:
  public/sky/day.jpg  — vivid blue sky with golden sun
  public/sky/night.jpg — deep twilight with warm horizon glow
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

SKY_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sky")
os.makedirs(SKY_DIR, exist_ok=True)

W, H = 4096, 2048  # equirectangular 2:1


def lerp_color(c1, c2, t):
    """Linear interpolation between two RGB tuples."""
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def create_gradient(width, height, top_color, horizon_color, bottom_color):
    """Create a vertical gradient image: top -> horizon -> bottom."""
    img = Image.new("RGB", (width, height))
    pixels = img.load()
    half = height // 2
    for y in range(height):
        if y < half:
            t = y / half
            color = lerp_color(top_color, horizon_color, t)
        else:
            t = (y - half) / half
            color = lerp_color(horizon_color, bottom_color, t)
        for x in range(width):
            pixels[x, y] = color
    return img


def add_sun(img, azimuth_deg, elevation_deg, sun_radius, sun_color, glow_radius, glow_color):
    """Add a sun disc with radial glow at the given position in equirectangular projection.

    Args:
        azimuth_deg: 0-360, 0=center of image, increases clockwise (right)
        elevation_deg: -90 (nadir) to 90 (zenith), 0=horizon (center vertical)
        sun_radius: radius of the sun disc in pixels
        sun_color: (r, g, b) for the sun disc
        glow_radius: radius of the glow in pixels
        glow_color: (r, g, b) for the glow
    """
    w, h = img.size

    # Convert spherical to equirectangular pixel coordinates
    # azimuth: 0° = center, positive = right (wraps around)
    # elevation: 0° = horizon (center), 90° = top, -90° = bottom
    cx = int((w / 2) + (azimuth_deg / 360) * w) % w
    cy = int(h / 2 - (elevation_deg / 90) * (h / 2))

    print(f"    Sun at ({cx}, {cy}) — azimuth={azimuth_deg}° elev={elevation_deg}°")

    # Create glow layer
    glow_layer = Image.new("RGB", (w, h), (0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_layer)

    # Draw radial glow (concentric circles from large/faint to small/bright)
    steps = 40
    for i in range(steps, 0, -1):
        r = int(glow_radius * (i / steps))
        intensity = 1.0 - (i / steps) ** 2  # non-linear falloff
        color = tuple(int(c * intensity) for c in glow_color)
        glow_draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=color,
        )

    # Blur the glow for smooth falloff
    glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=glow_radius // 4))

    # Screen blend the glow onto the image
    img = ImageChops.screen(img, glow_layer)

    # Draw the sun disc (sharp, bright)
    sun_layer = Image.new("RGB", (w, h), (0, 0, 0))
    sun_draw = ImageDraw.Draw(sun_layer)
    sun_draw.ellipse(
        [cx - sun_radius, cy - sun_radius, cx + sun_radius, cy + sun_radius],
        fill=sun_color,
    )
    # Slight blur on sun edge for soft disc
    sun_layer = sun_layer.filter(ImageFilter.GaussianBlur(radius=2))
    img = ImageChops.screen(img, sun_layer)

    return img


def add_clouds(img, density=0.3, opacity=0.15, seed=42):
    """Add subtle cloud noise for texture."""
    import random
    random.seed(seed)

    w, h = img.size
    # Create noise image
    noise = Image.new("L", (w // 4, h // 4))
    noise_pixels = noise.load()
    for y in range(h // 4):
        for x in range(w // 4):
            # Smooth noise using multiple octaves
            val = 0
            for octave in range(4):
                freq = 2 ** octave
                amp = 1.0 / freq
                val += random.random() * amp
            val = int(255 * val * density)
            noise_pixels[x, y] = val

    # Scale up and blur for soft clouds
    noise = noise.resize((w, h), Image.BILINEAR)
    noise = noise.filter(ImageFilter.GaussianBlur(radius=30))

    # Only apply clouds to upper half (sky)
    mask = Image.new("L", (w, h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rectangle([0, 0, w, h // 2], fill=int(opacity * 255))

    # Composite white clouds using noise as alpha
    cloud_color = Image.new("RGB", (w, h), (255, 255, 255))
    img.paste(cloud_color, (0, 0), ImageChops.multiply(noise, mask))

    return img


def generate_day():
    """Generate vivid daytime sky with golden sun."""
    print("  Generating day sky...")

    # Sky gradient: deep blue zenith -> lighter blue horizon -> hazy ground
    img = create_gradient(
        W, H,
        top_color=(25, 60, 135),       # deep blue zenith
        horizon_color=(140, 180, 220),  # hazy light blue horizon
        bottom_color=(80, 100, 130),    # muted ground
    )

    # Add sun at 22° elevation, 30° azimuth (front-right)
    img = add_sun(
        img,
        azimuth_deg=30, elevation_deg=22,
        sun_radius=45,
        sun_color=(255, 250, 230),  # warm white sun
        glow_radius=400,
        glow_color=(255, 230, 180),  # warm golden glow
    )

    # Add subtle clouds
    img = add_clouds(img, density=0.2, opacity=0.08, seed=42)

    # Boost saturation and contrast
    img = ImageEnhance.Color(img).enhance(1.3)
    img = ImageEnhance.Contrast(img).enhance(1.15)

    out_path = os.path.join(SKY_DIR, "day.jpg")
    img.save(out_path, "JPEG", quality=92, optimize=True)
    print(f"    OK: {os.path.getsize(out_path):,} bytes -> {out_path}")
    return out_path


def generate_night():
    """Generate deep twilight/night sky with warm horizon glow."""
    print("  Generating night sky...")

    # Sky gradient: deep navy zenith -> twilight horizon -> dark ground
    img = create_gradient(
        W, H,
        top_color=(8, 15, 40),        # deep navy zenith
        horizon_color=(60, 50, 80),    # purple twilight horizon
        bottom_color=(15, 20, 35),     # dark ground
    )

    # Add warm horizon glow (sunset remnants)
    # Use a wide, faint glow at the horizon
    horizon_glow = Image.new("RGB", (W, H), (0, 0, 0))
    glow_draw = ImageDraw.Draw(horizon_glow)
    # Warm band at horizon
    for i in range(200):
        y = H // 2 - 100 + i
        intensity = 1.0 - abs(i - 100) / 100.0
        color = tuple(int(c * intensity * 0.6) for c in (255, 140, 80))
        glow_draw.line([(0, y), (W, y)], fill=color)
    horizon_glow = horizon_glow.filter(ImageFilter.GaussianBlur(radius=50))
    img = ImageChops.screen(img, horizon_glow)

    # Add moon (faint, cool)
    img = add_sun(
        img,
        azimuth_deg=60, elevation_deg=35,
        sun_radius=30,
        sun_color=(220, 225, 240),  # cool moonlight
        glow_radius=250,
        glow_color=(100, 120, 160),  # faint cool glow
    )

    # Add stars
    import random
    random.seed(123)
    star_layer = Image.new("RGB", (W, H), (0, 0, 0))
    star_draw = ImageDraw.Draw(star_layer)
    for _ in range(800):
        x = random.randint(0, W - 1)
        y = random.randint(0, H // 2)  # only in sky
        brightness = random.randint(120, 255)
        size = random.choice([1, 1, 1, 2])
        star_draw.ellipse([x - size, y - size, x + size, y + size],
                          fill=(brightness, brightness, brightness))
    # Only show stars in upper sky (fade towards horizon)
    star_mask = Image.new("L", (W, H), 0)
    mask_draw = ImageDraw.Draw(star_mask)
    for y in range(H // 2):
        opacity = int(255 * (1.0 - y / (H // 2)) ** 1.5)
        mask_draw.line([(0, y), (W, y)], fill=opacity)
    img.paste(ImageChops.screen(img, star_layer), (0, 0), star_mask)

    # Boost saturation slightly
    img = ImageEnhance.Color(img).enhance(1.15)
    img = ImageEnhance.Contrast(img).enhance(1.1)

    out_path = os.path.join(SKY_DIR, "night.jpg")
    img.save(out_path, "JPEG", quality=92, optimize=True)
    print(f"    OK: {os.path.getsize(out_path):,} bytes -> {out_path}")
    return out_path


if __name__ == "__main__":
    print("=== Procedural Sky Generation (Pillow) ===")
    generate_day()
    generate_night()
    print("=== DONE ===")
