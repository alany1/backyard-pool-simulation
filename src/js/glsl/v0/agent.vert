uniform sampler2D heightmap;

uniform mat4 tf_agent_to_world;
uniform float waterWidth;
uniform float waterDepth;
uniform float water_resting_height;

#define PHONG

varying vec3 vViewPosition;
varying vec3 vWorldNormal;
#ifndef FLAT_SHADED

varying vec3 vNormal;

#endif

#include <common>

void main() {

    mat4 tf_agent_to_water = tf_agent_to_world; // missing the height drop to water

    vec4 agent_to_water = tf_agent_to_water * vec4(position, 1.0);

    // get the height displacement using the xz coordinates in the water frame
    vec2 uv = vec2((agent_to_water.x + waterWidth / 2.0) / waterWidth,
                   (agent_to_water.z + waterDepth / 2.0) / waterDepth);

    float displacement = texture2D(heightmap, uv).x;

    // final height (in water frame) = height (water) + displacement (water) + height ( original agent )
    vec4 transformed_to_water = vec4(agent_to_water.x, water_resting_height + displacement + position.y , agent_to_water.z, 1.0);

    vec3 transformed = (inverse(tf_agent_to_water) * transformed_to_water).xyz;



    #include <project_vertex>; // project from agent to camera
    return;

}
