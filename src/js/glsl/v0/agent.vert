uniform sampler2D heightmap;

uniform mat4 tf_agent_to_world;
uniform mat4 tf_water_to_world;
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
//#include <uv_pars_vertex>
//#include <displacementmap_pars_vertex>
//#include <envmap_pars_vertex>
//#include <color_pars_vertex>
//#include <morphtarget_pars_vertex>
//#include <skinning_pars_vertex>
//#include <shadowmap_pars_vertex>
//#include <logdepthbuf_pars_vertex>
//#include <clipping_planes_pars_vertex>

void main() {

    mat4 tf_agent_to_water = inverse(tf_water_to_world) * tf_agent_to_world;

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
//
//
//
//
//    vec4 agent_to_water = inverse(water_to_world) * agent_to_world * vec4(position, 1.0);
//    vec2 agent_to_water_xz = agent_to_water.xz;
//
//    // hack: world and water are parallel
//    vec4 transformed_to_world = agent_to_world * vec4(position, 1.0);
//    vec2 agent_to_world_xz = transformed_to_world.xz;
//
////    vec2 uv = vec2((agent_to_water_xz.x + waterWidth / 2.0) / waterWidth,
////    (agent_to_water_xz.y + waterDepth / 2.0) / waterDepth);
//
//    vec2 uv = vec2((transformed_to_world.x + waterWidth / 2.0) / waterWidth,
//    (transformed_to_world.y + waterDepth / 2.0) / waterDepth);
//
//
//    float height = texture2D(heightmap, uv).x;
//
////    vec3 transformed_to_water = vec3(agent_to_water_xz.x, agent_to_water_xz.y, height);
//    vec3 transformed_to_water = vec3(agent_to_water_xz.x, height, agent_to_water_xz.y);
//
//    vec4 transformed_to_agent = inverse(agent_to_world) * water_to_world * vec4(transformed_to_water, 1.0);
//    gl_Position = projectionMatrix * modelViewMatrix * transformed_to_agent;
//
////    float height = texture2D(heightmap, uv).x;
//
//    // transformed in the water frame
////    vec3 transformed_to_water = vec3(agent_to_water.x, height, agent_to_water.z);
//
//    // bring back to the model frame
////    vec4 transformed_to_agent = inverse(agent_to_world) * water_to_world * vec4(transformed_to_water, 1.0);
//
////    #include <project_vertex>
////    gl_Position = projectionMatrix * modelViewMatrix * transformed_to_agent;

}
