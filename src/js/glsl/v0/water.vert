uniform sampler2D heightmap;
varying vec3 vPosition;
varying vec3 vWorldPosition;
#define PHONG

varying vec3 vViewPosition;
varying vec3 vWorldNormal;
#ifndef FLAT_SHADED

varying vec3 vNormal;

#endif

#include <common>

void main() {

    vec2 cellSize = vec2(1.0 / WIDTH, 1.0 / WIDTH);

    #include <uv_vertex>

    // Compute normal from heightmap
    vec3 objectNormal = vec3(
    (texture2D(heightmap, uv + vec2(- cellSize.x, 0)).x - texture2D(heightmap, uv + vec2(cellSize.x, 0)).x) * WIDTH / BOUNDS,
    (texture2D(heightmap, uv + vec2(0, - cellSize.y)).x - texture2D(heightmap, uv + vec2(0, cellSize.y)).x) * WIDTH / BOUNDS,
    1.0);
    //<beginnormal_vertex>

    vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);

    float heightValue = texture2D(heightmap, uv).x;
    vec3 transformed = vec3(position.x, position.y, heightValue);

    #include <project_vertex>

    vViewPosition = - mvPosition.xyz;

    vPosition = position;
    vWorldPosition = (mat3(modelMatrix) * position);

}
