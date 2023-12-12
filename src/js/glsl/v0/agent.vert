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
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

vec3 extractScale(mat4 matrix) {
    float scaleX = length(vec3(matrix[0][0], matrix[1][0], matrix[2][0]));
    float scaleY = length(vec3(matrix[0][1], matrix[1][1], matrix[2][1]));
    float scaleZ = length(vec3(matrix[0][2], matrix[1][2], matrix[2][2]));
    return vec3(scaleX, scaleY, scaleZ);
}

void main() {
    #include <uv_vertex>
    #include <color_vertex>

    vec3 objectNormal = vec3(normal);

    #include <morphnormal_vertex>
    #include <skinbase_vertex>
    #include <skinnormal_vertex>
    #include <defaultnormal_vertex>

    #ifndef FLAT_SHADED // Normal computed with derivatives when FLAT_SHADED

    vNormal = normalize( transformedNormal );

    #endif

    mat4 tf_agent_to_water = tf_agent_to_world; // missing the height drop to water

    vec4 agent_to_water = tf_agent_to_water * vec4(position, 1.0);

    // get the height displacement using the xz coordinates in the water frame
    vec2 uv = vec2((agent_to_water.x + waterWidth / 2.0) / waterWidth,
                   (agent_to_water.z + waterDepth / 2.0) / waterDepth);

    float displacement = texture2D(heightmap, uv).x;

    // final height (in water frame) = height (water) + displacement (water) + height ( original agent )
//    vec4 transformed_to_water = vec4(agent_to_water.x, water_resting_height + displacement + 1.5 * position.y  , agent_to_water.z, 1.0);
    float scale_y = extractScale(tf_agent_to_water).y;

    vec4 transformed_to_water = vec4(agent_to_water.x, water_resting_height + 1.5 * displacement + scale_y * position.y, agent_to_water.z, 1.0);

    if (agent_to_water.z > -10.0 && agent_to_water.z < 10.0) {
        vec4 transformed_to_water = vec4(agent_to_water.x, water_resting_height + 0. * displacement + scale_y * position.y  , agent_to_water.z , 1.0);
    }

    vec3 transformed = (inverse(tf_agent_to_water) * transformed_to_water).xyz;


    #include <morphtarget_vertex>
    #include <skinning_vertex>
    #include <displacementmap_vertex>
    #include <project_vertex>

    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>

    vViewPosition = - mvPosition.xyz;

    #include <worldpos_vertex>
    #include <envmap_vertex>
    #include <shadowmap_vertex>

}
