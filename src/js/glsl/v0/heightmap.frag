
#include <common>

uniform mat4 tf_water_to_world;
uniform vec3 agentPosition;
uniform vec2 mousePos;
uniform float mouseSize;
uniform float viscosityConstant;
uniform float heightCompensation;

void main()	{

    vec2 cellSize = 1.0 / resolution.xy;

    vec2 uv = gl_FragCoord.xy * cellSize;

    // heightmapValue.x == height from previous frame
    // heightmapValue.y == height from penultimate frame
    // heightmapValue.z, heightmapValue.w not used
    vec4 heightmapValue = texture2D( heightmap, uv );

    // Get neighbours
    vec4 north = texture2D( heightmap, uv + vec2( 0.0, cellSize.y ) );
    vec4 south = texture2D( heightmap, uv + vec2( 0.0, - cellSize.y ) );
    vec4 east = texture2D( heightmap, uv + vec2( cellSize.x, 0.0 ) );
    vec4 west = texture2D( heightmap, uv + vec2( - cellSize.x, 0.0 ) );

    // https://web.archive.org/web/20080618181901/http://freespace.virgin.net/hugo.elias/graphics/x_water.htm
    // Looks like here we are damping it by calculating the average of the neighbours and then subtracting the current height

    float newHeight = ( ( north.x + south.x + east.x + west.x ) * 0.5 - heightmapValue.y ) * viscosityConstant;

    // Mouse influence

//    vec4 agent_to_water = inverse(tf_agent_to_world) * vec4( agentPosition, 1.0 );
    vec4 agent_to_water =  vec4( agentPosition, 1.0 );

    // project agent position onto water plane.
    // before: -BOUNDS to BOUNDS
    // now in the range 0 to 1
//    vec2 agent_uv = vec2((agent_to_water.x + BOUNDS) / (2.0 * BOUNDS), (agent_to_water.z + BOUNDS) / (2.0 * BOUNDS));
    vec2 agent_uv = vec2((agent_to_water.x + BOUNDS / 2.0 )/ BOUNDS, (-agent_to_water.z + BOUNDS / 2.0) / BOUNDS);
    // scale to (-BOUNDS/2, BOUNDS/2)
    agent_uv = agent_uv * BOUNDS - vec2(BOUNDS / 2.0);


    float mousePhase = clamp( length( ( uv - vec2( 0.5 ) ) * BOUNDS - vec2( agent_uv.x, agent_uv.y ) ) * PI / mouseSize, 0.0, PI );

    // u and v from (0, 1) to (-BOUNDS/2, BOUNDS/2)
    newHeight -= ( cos( mousePhase ) + 1.0 ) * 0.28;

    heightmapValue.y = heightmapValue.x;
    heightmapValue.x = newHeight;

    gl_FragColor = heightmapValue;

}
