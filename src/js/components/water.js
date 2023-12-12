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
    RGBAFormat,
    UnsignedByteType,
    WebGLRenderTarget,
    DirectionalLight,
    CubeTextureLoader,
    Vector3,
    BoxGeometry,
    MeshBasicMaterial,
    MeshPhysicalMaterial,
    DoubleSide,
    NormalBlending,
    TextureLoader,
    Sphere,
    TorusGeometry,
    MeshPhongMaterial,
    Quaternion,
} from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'stats-js'
import LoaderManager from '@/js/managers/LoaderManager'
import GUI from 'lil-gui'
import waterVertexShader from '@/js/glsl/v0/water.vert'
import waterFragmentShader from '@/js/glsl/v0/water.frag'
import {GPUComputationRenderer} from "three/addons/misc/GPUComputationRenderer.js";
import smoothFragmentShader from '@/js/glsl/v0/smoothing.frag'
import readWaterLevelFragmentShader from '@/js/glsl/v0/read_water_level.frag'
import heightmapFragmentShader from '@/js/glsl/v0/heightmap.frag'
import agentVertexShader from '@/js/glsl/v0/agent.vert'
import agentFragmentShader from '@/js/glsl/v0/agent.frag'
import {SimplexNoise} from 'three/addons/math/SimplexNoise.js';
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js";
import meshPhongNodeMaterial from "three/addons/nodes/materials/MeshPhongNodeMaterial.js";

const simplex = new SimplexNoise();

const WIDTH = 128;

// Water size in system units
const BOUNDS = 512;
let waterUniforms;
let agentUniforms;
let heightmapUniforms;
let gpuCompute;
let heightmapVariable;
let smoothShader;
let readWaterLevelShader;
let readWaterLevelImage;
let readWaterLevelRenderTarget;
let lastTimestamp = performance.now();
let deltaTime = 0;
let xSpeed = 0.1;
let ySpeed = 10;

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
    #cube_mesh
    #plane_mesh
    #sphere;
    #gui
    #settings
    #controls_on = false;

    constructor() {
        this.#canvas = document.querySelector('.scene')

        this.animate = this.animate.bind(this);

        this.init()
    }

    async init() {

        let container = document.createElement('div');
        document.body.appendChild(container)

        this.#camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
        this.#camera.position.set(350, 400, -500)
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
        cubeTextureLoader.setPath('textures/park/');

        const cubeTexture = cubeTextureLoader.load([
            'px.jpg', 'nx.jpg',
            'py.jpg', 'ny.jpg',
            'pz.jpg', 'nz.jpg'
        ]);

        this.#scene.background = cubeTexture;


        this.setControls()
        this.setAxesHelper()

        await this.setAgent()
        this.setWater()
        this.setGround()
        this.setWalls()

        this.setListeners()
        /////////////////////////

        this.handleResize()

        // start RAF
        this.events()
        this.animate()
    }


    animate() {

        requestAnimationFrame(this.animate);

        const currentTimestamp = performance.now();
        deltaTime = (currentTimestamp - lastTimestamp) / 1000; // Convert to seconds
        lastTimestamp = currentTimestamp;

        if (!this.#controls_on) {
            this.stepAgent(deltaTime);
        }

        this.render();
        this.#stats.update();
    }

    stepAgent(deltaTime) {
        const radius = BOUNDS / 4;

        const speed = 2 * Math.PI * radius / 2;

        this.currentAngle = (this.currentAngle || 0) + (speed * deltaTime) / radius;
        this.currentAngle = this.currentAngle % (2 * Math.PI);

        const x = radius * Math.cos(this.currentAngle);
        const z = radius * Math.sin(this.currentAngle);

        this.#sphere.position.x = x;
        this.#sphere.position.z = z;

        this.#sphere.rotation.y = -(this.currentAngle); //  - Math.PI / 2);
    }


    render() {
        // const uniforms = heightmapVariable.material.uniforms;
        // uniforms['mousePos'].value.set(10000, 10000)
        gpuCompute.compute();
        waterUniforms['heightmap'].value = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
        waterUniforms['cameraPos'].value.copy(this.#camera.position);
        waterUniforms['agentPosition'].value = this.#sphere.position;
        waterUniforms['tf_agent_to_world'].value = this.#sphere.matrixWorld;

        heightmapUniforms['agentPosition'].value = this.#sphere.position;
        heightmapUniforms['tf_water_to_world'].value = this.#plane_mesh.matrixWorld;

        agentUniforms['heightmap'].value = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;
        agentUniforms['tf_agent_to_world'].value = this.#sphere.matrixWorld;
        agentUniforms['tf_water_to_world'].value = this.#plane_mesh.matrixWorld;

        this.#renderer.render(this.#scene, this.#camera);
        console.log('done')
    }

    loadModel(material) {
        return new Promise((resolve, reject) => {
            const loader = new OBJLoader();
            loader.load(
                'textures/Duck.obj', // Path to the OBJ file
                (obj) => {
                    // Assuming the model is a single object
                    const model = obj.children[0];

                    // Apply any initial transformations
                    model.position.set(0, 0, 0);
                    model.scale.set(10, 10, 10);  // Set scale if needed
                    // this.#sphere.rotation.y = -Math.pi / 2;  // Set rotation if needed

                    // Replace this.#sphere with the loaded model
                    this.#sphere = model;
                    // this.#sphere.matrixAutoUpdate = false;
                    this.#sphere.updateMatrix()

                    // Change material
                    this.#sphere.material = material;

                    // Add the model to the scene
                    this.#scene.add(this.#sphere);

                    resolve(model); // Resolve the Promise with the loaded model
                },
                undefined, // Function called when download is in progress
                (error) => {
                    console.error('An error happened', error);
                    reject(error); // Reject the Promise on error
                }
            );
        });
    }


    async setAgent() {
        const materialColor = 0xFFD801;
        // const geometry = new SphereGeometry( 10, 32, 32 );
        // const geometry = new TorusGeometry( 10, 3, 16, 100 );
        // // const material = new MeshBasicMaterial( {color: 0xffff00} );
        const material = new ShaderMaterial({
            uniforms: UniformsUtils.merge([
                ShaderLib['phong'].uniforms,
                {
                    'heightmap': {value: null},
                    'tf_agent_to_world': {value: null},
                    'tf_water_to_world': {value: null},
                    'waterWidth': {value: BOUNDS},
                    'waterDepth': {value: BOUNDS},
                    'water_resting_height': {value: -BOUNDS / 16},
                }
            ]),
            vertexShader: agentVertexShader,
            fragmentShader: ShaderChunk['meshphong_frag'],
        });

        material.lights = true;
        material.uniforms['diffuse'].value = new Color(materialColor);
        material.uniforms['specular'].value = new Color(0x111111);
        material.uniforms['shininess'].value = Math.max(50, 1e-4);
        material.uniforms['opacity'].value = material.opacity;
        material.defines.WIDTH = WIDTH.toFixed(1);
        material.defines.BOUNDS = BOUNDS.toFixed(1);
        agentUniforms = material.uniforms;

        const phongMaterial = new MeshPhongMaterial({
            color: 0xaaaaaa,
            specular: 0x111111,
            shininess: 30
        });
        //

        try {
            await this.loadModel(material);
            console.log('Model loaded')
            console.log(this.#sphere.position)
        } catch (error) {
            console.error(error);
        }

        console.log(this.#sphere.position)
        //
        // this.#sphere = new Mesh( geometry, material );
        // this.#sphere.position.set(0, 0, 0)
        // this.#sphere.rotation.y = -Math.PI / 2;
        //
        // this.#scene.add( this.#sphere );

    }

    setListeners() {
        document.addEventListener("keydown", (event) => this.onDocumentKeyDown(event), false);
    }

    onDocumentKeyDown(event) {
        console.log(this.#controls_on)
        if (!this.#controls_on) {
            return;
        }

        var keyCode = event.which;

        const forward = this.getHeading();

        console.log('yo')
        if (keyCode == 87) { // w
            this.#sphere.position.x += forward.x * ySpeed;
            this.#sphere.position.z += forward.z * ySpeed;
        } else if (keyCode == 83) { // s
            this.#sphere.position.x -= forward.x * ySpeed;
            this.#sphere.position.z -= forward.z * ySpeed;
        } else if (keyCode == 65) { // a
            this.#sphere.rotation.y += xSpeed;
        } else if (keyCode == 68) { // d
            this.#sphere.rotation.y -= xSpeed;
        } else if (keyCode == 82) { // r (reset)
            this.#sphere.position.set(0, 0, 0);
        }
    };

    getHeading() {
        let yRotation = this.#sphere.rotation.y;
        let forward = new Vector3(0, 0, 1);
        let quaternion = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yRotation);

        forward.applyQuaternion(quaternion);

        return forward;
    }

    setLights() {
        const sun = new DirectionalLight(0xFFFFFF, 3.0);
        sun.position.set(300, 400, 175);
        this.#scene.add(sun);

        const sun2 = new DirectionalLight(0x40A040, 2.0);
        sun2.position.set(-100, 350, -200);
        this.#scene.add(sun2);

    }


    setWalls() {
        const texture = new TextureLoader().load('textures/pool_floor.jpg')
        const geometry = new PlaneGeometry(BOUNDS, BOUNDS / 2, WIDTH - 1, WIDTH - 1);
        const material = new MeshBasicMaterial(
            {
                map: texture,
                side: DoubleSide
            }
        )
        const wall_1 = new Mesh(geometry, material);
        wall_1.rotation.y = -Math.PI / 2;
        wall_1.position.x = -BOUNDS / 2;
        wall_1.position.y = -BOUNDS / 4;

        wall_1.matrixAutoUpdate = false;
        wall_1.updateMatrix();

        const wall_2 = new Mesh(geometry, material);
        wall_2.rotation.y = -Math.PI / 2;
        wall_2.position.x = BOUNDS / 2;
        wall_2.position.y = -BOUNDS / 4;

        wall_2.matrixAutoUpdate = false;
        wall_2.updateMatrix();

        const wall_3 = new Mesh(geometry, material);
        wall_3.position.z = -BOUNDS / 2;
        wall_3.position.y = -BOUNDS / 4;

        wall_3.matrixAutoUpdate = false;
        wall_3.updateMatrix();
        //
        const wall_4 = new Mesh(geometry, material);
        wall_4.position.z = BOUNDS / 2;
        wall_4.position.y = -BOUNDS / 4;

        wall_4.matrixAutoUpdate = false;
        wall_4.updateMatrix();


        this.#scene.add(wall_1);
        this.#scene.add(wall_2);
        this.#scene.add(wall_3);
        this.#scene.add(wall_4);
    }

    setGround() {
        const texture = new TextureLoader().load('textures/pool_wall_marble.jpg')
        const geometry = new PlaneGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1);
        const material = new MeshBasicMaterial(
            {
                map: texture
            }
        )
        const ground = new Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -BOUNDS / 2;

        ground.matrixAutoUpdate = false;
        ground.updateMatrix();
        this.#scene.add(ground);
    }

    setWater() {
        const materialColor = 0x0040C0;
        const geometry = new PlaneGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1);
        const material = new ShaderMaterial({
            uniforms: UniformsUtils.merge([
                ShaderLib['phong'].uniforms,
                {
                    'heightmap': {value: null},
                    'envMap': {value: this.#scene.background}, // Pass the cubemap here
                    'cameraPos': {value: new Vector3()}, // Camera position
                    'reflectionStrength': {value: .6},
                    'transparency': {value: 0.8},
                    'agentPosition': {value: null},
                    'tf_agent_to_world': {value: null},
                }
            ]),
            transparent: true,
            blending: NormalBlending,
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
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
        this.#plane_mesh.position.y = -BOUNDS / 16;
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

        heightmapUniforms = heightmapVariable.material.uniforms;

        heightmapVariable.material.uniforms['mousePos'] = {value: new Vector2(10000, 10000)};
        heightmapVariable.material.uniforms['mouseSize'] = {value: 20.0};
        heightmapVariable.material.uniforms['viscosityConstant'] = {value: 0.98};
        heightmapVariable.material.uniforms['heightCompensation'] = {value: 0};
        heightmapVariable.material.uniforms['agentPosition'] = {value: this.#sphere.position};
        heightmapVariable.material.uniforms['tf_water_to_world'] = {value: this.#plane_mesh.matrixWorld}
        heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1);

        const error = gpuCompute.init();
        if (error !== null) {

            console.error(error);

        }
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

        this.#gui = new GUI();
        this.#settings = {
            controls: false,
        };

        this.#gui.add(this.#settings, 'controls').name('Toggle Controls (WASD / R)').onChange((value) => {
            // Logic to handle toggle, e.g., show/hide a sphere in Three.js
            if (this.#controls_on) {
                this.#controls_on = false;
            } else {
                this.#controls_on = true;
            }
        });


    }

    setAxesHelper() {
        const axesHelper = new AxesHelper(100)
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
