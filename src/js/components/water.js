import {
  Color,
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Mesh,
  SphereGeometry,
  MeshMatcapMaterial,
  PlaneGeometry,
  ShaderMaterial,
  AxesHelper,
  Vector2,
  ShaderChunk,
  ShaderLib,
  UniformsUtils,
  HalfFloatType,
  ClampToEdgeWrapping,
  NearestFilter,
  RGBAFormat, UnsignedByteType, WebGLRenderTarget, DirectionalLight, CubeTextureLoader,
} from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'stats-js'
import LoaderManager from '@/js/managers/LoaderManager'
import GUI from 'lil-gui'
import waterVertexShader from '@/js/glsl/v0/water.vert'
import {GPUComputationRenderer} from "three/addons/misc/GPUComputationRenderer.js";
import smoothFragmentShader from '@/js/glsl/v0/smoothing.frag'
import readWaterLevelFragmentShader from '@/js/glsl/v0/read_water_level.frag'
import heightmapFragmentShader from '@/js/glsl/v0/heightmap.frag'
import {SimplexNoise} from 'three/addons/math/SimplexNoise.js';

const simplex = new SimplexNoise();

const WIDTH = 128;

// Water size in system units
const BOUNDS = 512;
let waterUniforms;
let gpuCompute;
let heightmapVariable;
let smoothShader;
let readWaterLevelShader;
let readWaterLevelImage;
let readWaterLevelRenderTarget;


export default class MainScene {
    #canvas
    #renderer
    #scene
    #camera
    #controls
    #stats
    #width
    #height
    #mesh
    #plane_mesh

    constructor() {
        this.#canvas = document.querySelector('.scene')

        this.animate = this.animate.bind(this);

        this.init()
    }

    init() {

        let container = document.createElement('div');
        document.body.appendChild(container)

        this.#camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
        this.#camera.position.set(0, 200, 350)
        this.#camera.lookAt(0, 0, 0)

        this.#scene = new Scene()
        this.setLights()

        this.#renderer = new WebGLRenderer({canvas: this.#canvas});
        this.#renderer.setPixelRatio(window.devicePixelRatio);
        this.#renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(this.#renderer.domElement);

        this.#stats = new Stats();
        container.appendChild(this.#stats.dom);

        const cubeTextureLoader = new CubeTextureLoader();
        cubeTextureLoader.setPath('textures/sky/');

        const cubeTexture = cubeTextureLoader.load([
          'px.jpg', 'nx.jpg',
          'py.jpg', 'ny.jpg',
          'pz.jpg', 'nz.jpg'
        ]);

        this.#scene.background = cubeTexture;


        this.setControls()
        this.setAxesHelper()

        this.setWater()

        /////////////////////////

        this.handleResize()

        // start RAF
        this.events()
        this.animate()
    }

    /**
     * Our Webgl renderer, an object that will draw everything in our canvas
     * https://threejs.org/docs/?q=rend#api/en/renderers/WebGLRenderer
     */

    animate() {

        requestAnimationFrame(this.animate);

        this.render();

        this.#stats.update();
    }

    render() {
        // const uniforms = heightmapVariable.material.uniforms;
        // uniforms['mousePos'].value.set(10000, 10000)

        gpuCompute.compute();
        waterUniforms['heightmap'].value = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
        this.#renderer.render(this.#scene, this.#camera);
    }

    setLights() {
        const sun = new DirectionalLight(0xFFFFFF, 3.0);
        sun.position.set(300, 400, 175);
        this.#scene.add(sun);

        const sun2 = new DirectionalLight(0x40A040, 2.0);
        sun2.position.set(-100, 350, -200);
        this.#scene.add(sun2);

    }

    setWater() {
        const materialColor = 0x0040C0;
        const geometry = new PlaneGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1);
        const material = new ShaderMaterial({
            uniforms: UniformsUtils.merge([
                ShaderLib['phong'].uniforms,
                {
                    'heightmap': {value: null}
                }
            ]),
            vertexShader: waterVertexShader,
            fragmentShader: ShaderChunk['meshphong_frag']
        });

        material.lights = true;

        material.uniforms['diffuse'].value = new Color(materialColor);
        material.uniforms['specular'].value = new Color(0x111111);
        material.uniforms['shininess'].value = Math.max(50, 1e-4);
        material.uniforms['opacity'].value = material.opacity;


        material.defines.WIDTH = WIDTH.toFixed(1);
        material.defines.BOUNDS = BOUNDS.toFixed(1);

        waterUniforms = material.uniforms;

        this.#plane_mesh = new Mesh(geometry, material);
        this.#plane_mesh.rotation.x = -Math.PI / 2;
        this.#plane_mesh.matrixAutoUpdate = false;
        this.#plane_mesh.updateMatrix();

        this.#scene.add(this.#plane_mesh)

        gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, this.#renderer);

        if (this.#renderer.capabilities.isWebGL2 === false) {

            gpuCompute.setDataType(HalfFloatType);

        }

        const heightmap0 = gpuCompute.createTexture();

        this.fillTexture(heightmap0);

        heightmapVariable = gpuCompute.addVariable('heightmap', heightmapFragmentShader, heightmap0);

        gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);

        heightmapVariable.material.uniforms['mousePos'] = {value: new Vector2(10000, 10000)};
        heightmapVariable.material.uniforms['mouseSize'] = {value: 20.0};
        heightmapVariable.material.uniforms['viscosityConstant'] = {value: 0.98};
        heightmapVariable.material.uniforms['heightCompensation'] = {value: 0};
        heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1);

        const error = gpuCompute.init();
        if (error !== null) {

            console.error(error);

        }

        // Create compute shader to smooth the water surface and velocity
        // smoothShader = gpuCompute.createShaderMaterial(smoothFragmentShader, {smoothTexture: {value: null}});

        // Create compute shader to read water level
        // readWaterLevelShader = gpuCompute.createShaderMaterial(readWaterLevelFragmentShader, {
        //     point1: {value: new Vector2()},
        //     levelTexture: {value: null}
        // });
        // readWaterLevelShader.defines.WIDTH = WIDTH.toFixed(1);
        // readWaterLevelShader.defines.BOUNDS = BOUNDS.toFixed(1);
        //
        // // Create a 4x1 pixel image and a render target (Uint8, 4 channels, 1 byte per channel) to read water height and orientation
        // readWaterLevelImage = new Uint8Array(4 * 1 * 4);
        // //
        // readWaterLevelRenderTarget = new WebGLRenderTarget(4, 1, {
        //     wrapS: ClampToEdgeWrapping,
        //     wrapT: ClampToEdgeWrapping,
        //     minFilter: NearestFilter,
        //     magFilter: NearestFilter,
        //     format: RGBAFormat,
        //     type: UnsignedByteType,
        //     depthBuffer: false
        // });

    }

    fillTexture = (texture) => {

        const waterMaxHeight = 10;

        function noise(x, y) {

            let multR = waterMaxHeight;
            let mult = 0.025;
            let r = 0;
            for (let i = 0; i < 15; i++) {

                r += multR * simplex.noise(x * mult, y * mult);
                multR *= 0.53 + 0.025 * i;
                mult *= 1.25;

            }

            return r;

        }

        const pixels = texture.image.data;

        let p = 0;
        for (let j = 0; j < WIDTH; j++) {

            for (let i = 0; i < WIDTH; i++) {

                const x = i * 128 / WIDTH;
                const y = j * 128 / WIDTH;

                pixels[p + 0] = noise(x, y);
                pixels[p + 1] = pixels[p + 0];
                pixels[p + 2] = 0;
                pixels[p + 3] = 1;

                p += 4;

            }

        }

    }

    setControls() {
        this.#controls = new OrbitControls(this.#camera, this.#renderer.domElement)
        this.#controls.enableDamping = true
        // this.#controls.dampingFactor = 0.04
    }

    setAxesHelper() {
        const axesHelper = new AxesHelper(3)
        this.#scene.add(axesHelper)
    }

    events() {
        window.addEventListener('resize', this.handleResize, {passive: true})
    }

    handleResize = () => {
        this.#width = window.innerWidth
        this.#height = window.innerHeight

        // Update camera
        this.#camera.aspect = this.#width / this.#height
        this.#camera.updateProjectionMatrix()

        const DPR = window.devicePixelRatio ? window.devicePixelRatio : 1

        this.#renderer.setPixelRatio(DPR)
        this.#renderer.setSize(this.#width, this.#height)
    }

}
