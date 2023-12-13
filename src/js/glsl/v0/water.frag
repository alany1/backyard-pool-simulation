uniform samplerCube envMap;// The cubemap
uniform vec3 cameraPos;
uniform float reflectionStrength;
uniform float transparency;

varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vPosition;
varying vec3 vWorldPosition;

void main() {
    vec3 normalColor = normalize(vWorldNormal) * 0.5 + 0.5;
    gl_FragColor = vec4(normalColor, 1.0);

    vec3 viewDir = -normalize(cameraPos - vWorldPosition);
    vec3 reflectDir = reflect(viewDir, normalize(vWorldNormal));
    vec3 envColor = textureCube(envMap, reflectDir).rgb;

    vec3 baseColor = vec3(0.5, 0.7, 0.9);// Soft, sky blue
    vec3 finalColor = mix(baseColor, envColor, reflectionStrength);

    gl_FragColor = vec4(finalColor, transparency);
}
