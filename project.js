import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Cube_Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.

// Placeholder class for snowflakes
class Snowflake {
  constructor() {
    //const r = 5 * Math.sqrt(Math.random());
    //const theta = Math.random() * Math.PI * 2;

    var d, x, y, z;
    // do {
    //     x = Math.random() * 10 - 5;
    //     y = Math.random() * 2 + 3;
    //     z = Math.random() * 10 - 5;
    //     d = x*x + y*y + z*z;
    // } while(d > 25);
    x = Math.random() * 10 - 5;
    y = Math.random() * 1 + 4;
    z = Math.random() * 10 - 5;

    this.pos = vec3(x, y+5, z);
    this.spin_axis = vec3( 0,0,0 ).randomized(1).normalized();

    this.angle = Math.random() * Math.PI * 2;
    this.angular_velocity = Math.random()*15+10;
    this.velocity = vec3(Math.random()*0.1, -3*(2+Math.random()*0.4), Math.random()*0.3);
  }
  advance(timestep) {
    this.pos = this.pos.plus(this.velocity.times(timestep));
    this.angle += this.angular_velocity*timestep;
  }
}

export
const Project_base = defs.Project_base =
    class Project_base extends Component
    {                                          
      // **My_Demo_Base** is a Scene that can be added to any display canvas.
      // This particular scene is broken up into two pieces for easier understanding.
      // The piece here is the base class, which sets up the machinery to draw a simple
      // scene demonstrating a few concepts.  A subclass of it, Assignment2,
      // exposes only the display() method, which actually places and draws the shapes,
      // isolating that code so it can be experimented with on its own.

      init()
      {
        console.log("init")

        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;
        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = { 'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 7),
          'axis' : new defs.Axis_Arrows(),
          'cube' : new defs.Cube(),
          'square' : new defs.Square(),
          'windmill' : new defs.Windmill(1),
          'torus': new defs.Torus(15, 15, [[0,2],[0,1]])};

        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const basic = new defs.Basic_Shader();
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        const reflective = new defs.Reflective();
        const cube_map = new defs.Cube_Map();
        const snow_shader = new defs.Snow_Shader();
        const cloud = new defs.Clouds();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: 1, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,0.21 ) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }
        this.materials.snowflake = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/snowflake2.png" ) }
        //this.materials.snow = { shader: snow_shader, ambient: .5, texture: new Texture("assets/rgb.jpg")}
        this.materials.snow = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( 1,1,1,1 ) }
        this.materials.water = {shader: phong, ambient: .2, diffusivity: 1, specularity: .1, color: color(0, 0, 1, .95)};
        this.materials.cloud = {shader: cloud};

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;


        const skybox_files = [
          // 'assets/skybox/front.jpg',
          // 'assets/skybox/back.jpg',
          // 'assets/skybox/bottom.jpg',
          // 'assets/skybox/top.jpg',
          // 'assets/skybox/front.jpg',
          // 'assets/skybox/right.jpg'

          'assets/winter-skyboxes/Backyard/posx.jpg',
          'assets/winter-skyboxes/Backyard/negx.jpg',
          'assets/winter-skyboxes/Backyard/negy.jpg',
          'assets/winter-skyboxes/Backyard/posy.jpg',
          'assets/winter-skyboxes/Backyard/posz.jpg',
          'assets/winter-skyboxes/Backyard/negz.jpg'
          // 'assets/skybox/pos-x.jpg',
          // 'assets/skybox/neg-x.jpg',
          // 'assets/skybox/neg-y.jpg',
          // 'assets/skybox/pos-y.jpg',
          // 'assets/skybox/pos-z.jpg',
          // 'assets/skybox/neg-z.jpg'

        ];
        const cube_texture = new Cube_Texture(skybox_files);
        this.materials.reflective = { shader: reflective, ambient: .5, texture: cube_texture};// new Texture( "assets/rgb.jpg" ) }
        this.materials.environment = {shader: cube_map, texture: cube_texture};
        
        
        // snow
        
        this.ground_res = 32;
        this.init_terrain();
        
        const row_operation    = (s,p)   => this.terrain[0][Math.round(s*this.ground_res)];
        const column_operation = (t,p,s) => this.terrain[Math.round(t*this.ground_res)][Math.round(s*this.ground_res)];
  
        this.ground = { terrain : new defs.Grid_Patch(this.ground_res, this.ground_res, row_operation, column_operation )};

        // snow walls
        this.snow_wall = [];
        for (let x = 0; x <= this.ground_res; x ++){
          this.snow_wall.push (new Array (2));
          this.snow_wall[x][0] = vec3(this.terrain[x][0][0],2.1,this.terrain[x][0][2]);
          this.snow_wall[x][1] = this.terrain[x][0];
        }
        for (let x = 0; x <= this.ground_res; x ++){
          this.snow_wall.push (new Array (2));
          this.snow_wall[this.ground_res+x][0] = this.terrain[this.ground_res][x];
          this.snow_wall[this.ground_res+x][1] = this.terrain[this.ground_res][x];
        }
        for (let x = 0; x <= this.ground_res; x ++){
          this.snow_wall.push (new Array (2));
          this.snow_wall[this.ground_res*2+x][0] = vec3(this.terrain[this.ground_res - x][this.ground_res][0],2.1,this.terrain[this.ground_res - x][this.ground_res][2]);
          this.snow_wall[this.ground_res*2+x][1] = this.terrain[this.ground_res - x][this.ground_res];
        }
        for (let x = 0; x <= this.ground_res; x ++){
          this.snow_wall.push (new Array (2));
          this.snow_wall[this.ground_res*3+x][0] = vec3(this.terrain[0][this.ground_res - x][0],2.1,this.terrain[0][this.ground_res - x][2]);
          this.snow_wall[this.ground_res*3+x][1] = this.terrain[0][this.ground_res - x];
        }
        const row_operation_2    = (s,p)   => this.snow_wall[Math.round(s*this.ground_res*4)][0];
        const column_operation_2 = (t,p,s) => this.snow_wall[Math.round(s*this.ground_res*4)][Math.round(t)];
  
        this.wall = { snow : new defs.Grid_Patch(this.ground_res*4, 2, row_operation_2, column_operation_2)};

        // water
        this.update_water = 0;
        this.water_res = 32;
        this.water_v = [];
        this.water_u = [];
        this.water_s = [];
        for (let x = 0; x <= this.water_res; x ++){
          this.water_v.push (new Array (this.water_res +1));
          this.water_u.push (new Array (this.water_res +1));
          this.water_s.push (new Array(this.water_res +1));
          for(let z = 0; z <= this.water_res; z++){
            const x_pos = x/this.water_res*10-5;
            const z_pos = z/this.water_res*10-5
            this.water_v[x][z] = 0;
            this.water_u[x][z] = 0;
            this.water_s[x][z] = vec3(x_pos, 2.1, z_pos);
          }
        }
        this.water_u[this.water_res*3/4][this.water_res/2] = -1;
        const row_operation_3    = (s,p)   => this.water_s[0][Math.round(s*this.water_res)];
        const column_operation_3 = (t,p,s) => this.water_s[Math.round(t*this.water_res)][Math.round(s*this.water_res)];
  
        this.water = { surface : new defs.Grid_Patch(this.water_res, this.water_res, row_operation_3, column_operation_3)};

        //water wall
        this.water_wall = [];
        for (let x = 0; x <= this.ground_res; x ++){
          this.water_wall.push (new Array (2));
          this.water_wall[x][0] = this.terrain[this.ground_res][x];
          this.water_wall[x][1] = this.water_s[this.ground_res][x];
        }
        const row_operation_4    = (s,p)   => this.water_wall[Math.round(s*this.ground_res)][0];
        const column_operation_4 = (t,p,s) => this.water_wall[Math.round(s*this.ground_res)][Math.round(t)];
  
        this.wall = { water : new defs.Grid_Patch(this.ground_res, 2, row_operation_4, column_operation_4),
                      snow : new defs.Grid_Patch(this.ground_res*4, 2, row_operation_2, column_operation_2)};
      }

      init_terrain () {
        this.terrain = [];
        this.temp_terrain = [];
        this.temp_terrain_2 = [];
        for (let x = 0; x <= this.ground_res; x ++){
          this.terrain.push (new Array (this.ground_res +1));
          this.temp_terrain.push (new Array (this.ground_res +1));
          this.temp_terrain_2.push (new Array (this.ground_res +1));
          for(let z = 0; z <= this.ground_res; z++){
            const x_pos = x/this.ground_res*10-5;
            const z_pos = z/this.ground_res*10-5
            let h = Math.sin(x/this.ground_res*Math.PI+Math.PI/2)*Math.sin(z/this.ground_res*Math.PI);
            if (h < -.1){
              h -= Math.random()*.1;
              h *= 7;
            } else if( h > .1){
              h += Math.random()*.1;
            }

            this.terrain[x][z] = vec3(x_pos, h+2.1, z_pos);
          }
        }
      }

      render_animation( caller )
      {                                                // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Assignment2, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          // TODO: you can change the camera as needed.
          Shader.assign_camera( Mat4.look_at (vec3 (0, 5, -10), vec3 (0, 5, 0), vec3 (0, 1, 0)), this.uniforms );
          //Shader.assign_camera( Mat4.look_at (vec3(8.0, -5.5, 8.0), vec3 (0, 0, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;

        // todo: assign camera this way would make movement controls useless. Is this intended.
        Shader.assign_camera( Mat4.look_at (vec3 (0, 7, -18), vec3 (0, 6, 0), vec3 (0, 1, 0)).times(Mat4.rotation(t/4,0,1,0)), this.uniforms );

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(20, 20, 20, 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];
      }
    }

export class Project extends Project_base
{                                                    
  // **Assignment2** is a Scene object that can be added to any display canvas.
  // This particular scene is broken up into two pieces for easier understanding.
  // See the other piece, My_Demo_Base, if you need to see the setup code.
  // The piece here exposes only the display() method, which actually places and draws
  // the shapes.  We isolate that code so it can be experimented with on its own.
  // This gives you a very small code sandbox for editing a simple scene, and for
  // experimenting with matrix transformations.

  snowflakes = [];
  has_init = false;
  render_animation( caller )
  {                                                // display():  Called once per frame of animation.  For each shape that you want to
    // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
    // different matrix value to control where the shape appears.

    // Variables that are in scope for you to use:
    // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
    // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
    // this.materials.metal:    Selects a shader and draws with a shiny surface.
    // this.materials.plastic:  Selects a shader and draws a more matte surface.
    // this.lights:  A pre-made collection of Light objects.
    // this.hover:  A boolean variable that changes when the user presses a button.
    // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
    // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

    // Call the setup code that we left inside the base class:
    super.render_animation( caller );

    /**********************************
     Start coding down here!!!!
     **********************************/
    // From here on down it's just some example shapes drawn for you -- freely
    // replace them with your own!  Notice the usage of the Mat4 functions
    // translation(), scale(), and rotation() to generate matrices, and the
    // function times(), which generates products of matrices.

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 ), white = color(1, 1, 1, 0.8),
          wall_color = color( 0.7, 1.0, 0.8, 1 ), 
          blackboard_color = color( 0.2, 0.2, 0.2, 1 ),
          test = color( 1,0.7,0,.1 );

    const t = this.t = this.uniforms.animation_time/1000;

 



    // Draw Environment
    this.shapes.square.draw(caller, this.uniforms, Mat4.identity(), this.materials.environment);
    this.shapes.square.draw(caller, this.uniforms, Mat4.identity(), this.materials.cloud);

    // Draw terrain
    //this.ground.terrain.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb)
    // TODO: you should draw scene here.
    // TODO: you can change the wall and board as needed.

    // this.shapes.windmill.draw(caller, this.uniforms, Mat4.translation(7,3,0), this.materials.metal);
    //this.shapes.torus.draw(caller, this.uniforms, Mat4.translation(7,3,0).times(Mat4.scale(2,2,2)), {...this.materials.plastic, color: white});

    // if (!this.has_init) {
    //   //todo: initialize based on parsed commands.
    //   this.initialize_snowflakes();
    //   this.has_init = true;
    // }
    for (let i = 0; i < 3; i += 1) {
      this.snowflakes.push(new Snowflake());
    }

    // Advance snowflake logic and graph all snowflakes.
    for (let each_snowflake of this.snowflakes) {
      each_snowflake.advance(0.01);
      this.graph_snowflake(each_snowflake, caller);
      // Update the terrain if snowflake below certain height.
      if (each_snowflake.pos[1] <= 3){
        const x = each_snowflake.pos[0];
        const z = each_snowflake.pos[2];
        let x_pos = Math.round((x + 5)/10*this.ground_res);
        let z_pos= Math.round((z + 5)/10*this.ground_res);
        // if (x**2 + z**2 + 4 < 4.6**2)
        x_pos = Math.min(x_pos, this.ground_res)
        x_pos = Math.max(x_pos, 0);
        z_pos = Math.min(z_pos, this.ground_res)
        z_pos = Math.max(z_pos, 0);
        this.terrain[x_pos][z_pos] = this.terrain[x_pos][z_pos].plus(vec3(0,.01,0));

      }
    }
    // Blur terrain to make it smoother
    for(let i = 0; i <= this.ground_res; i++) {
      for(let j = 0; j <= this.ground_res; j++) {
        if ((i ==0 || i == this.ground_res) && (j != 0 && j != this.ground_res)) {
          let h_blur = this.terrain[i][j][1]+this.terrain[i][j-1][1]+this.terrain[i][j+1][1];
          this.temp_terrain[i][j] = vec3(this.terrain[i][j][0], h_blur/3, this.terrain[i][j][2]);
        } else if ((j ==0 || j == this.ground_res) && (i != 0 && i != this.ground_res)) {
          let h_blur = this.terrain[i][j][1]+this.terrain[i-1][j][1]+this.terrain[i+1][j][1];
          this.temp_terrain[i][j] = vec3(this.terrain[i][j][0], h_blur/3, this.terrain[i][j][2]);
        } 
        else if (i ==0 || i == this.ground_res || j == 0 || j == this.ground_res)
          this.temp_terrain[i][j] = this.terrain[i][j];
        else {
          let h_blur = this.terrain[i][j][1]+this.terrain[i+1][j][1]+this.terrain[i-1][j][1]+this.terrain[i][j+1][1]+this.terrain[i][j-1][1];
          this.temp_terrain[i][j] = vec3(this.terrain[i][j][0], h_blur/5, this.terrain[i][j][2]);
        }
      }
    }
    for(let i = 0; i <= this.ground_res; i++) {
      for(let j = 0; j <= this.ground_res; j++) {
        if ((i ==0 || i == this.ground_res) && (j != 0 && j != this.ground_res)) {
          let h_blur = this.temp_terrain[i][j][1]+this.temp_terrain[i][j-1][1]+this.temp_terrain[i][j+1][1];
          this.temp_terrain_2[i][j] = vec3(this.temp_terrain[i][j][0], h_blur/3, this.temp_terrain[i][j][2]);
        } else if ((j ==0 || j == this.ground_res) && (i != 0 && i != this.ground_res)) {
          let h_blur = this.temp_terrain[i][j][1]+this.temp_terrain[i-1][j][1]+this.temp_terrain[i+1][j][1];
          this.temp_terrain_2[i][j] = vec3(this.temp_terrain[i][j][0], h_blur/3, this.temp_terrain[i][j][2]);
        } 
        else if (i ==0 || i == this.ground_res || j == 0 || j == this.ground_res)
          this.temp_terrain_2[i][j] = this.temp_terrain[i][j];
        else {
          let h_blur = this.temp_terrain[i][j][1]+this.temp_terrain[i+1][j][1]+this.temp_terrain[i-1][j][1]+this.temp_terrain[i][j+1][1]+this.temp_terrain[i][j-1][1];
          this.temp_terrain_2[i][j] = vec3(this.temp_terrain[i][j][0], h_blur/5, this.temp_terrain[i][j][2]);
        }
      }
    }

    const row_operation    = (s,p)   => this.temp_terrain_2[0][Math.round(s*this.ground_res)];
    const column_operation = (t,p,s) => this.temp_terrain_2[Math.round(t*this.ground_res)][Math.round(s*this.ground_res)];
    this.ground.terrain.update_points(caller, row_operation, column_operation);

    // update snow walls
    for (let x = 0; x <= this.ground_res; x ++){
      this.snow_wall[x][1] = this.temp_terrain_2[x][0];
    }
    for (let x = 0; x <= this.ground_res; x ++){
      this.snow_wall[this.ground_res+x][1] = this.temp_terrain_2[this.ground_res][x];
    }
    for (let x = 0; x <= this.ground_res; x ++){
      this.snow_wall[this.ground_res*2+x][1] = this.temp_terrain_2[this.ground_res - x][this.ground_res];
    }
    for (let x = 0; x <= this.ground_res; x ++){
      this.snow_wall[this.ground_res*3+x][1] = this.temp_terrain_2[0][this.ground_res - x];
    }
    const row_operation_2    = (s,p)   => this.snow_wall[Math.round(s*this.ground_res*4)][0];
    const column_operation_2 = (t,p,s) => this.snow_wall[Math.round(s*this.ground_res*4)][Math.round(t)];
    this.wall.snow.update_points(caller, row_operation_2, column_operation_2);

    //update water
    if(this.update_water % 300 == 0){
     this.water_u[this.water_res*3/4+1][this.water_res/2] = -1;
    //  this.water_u[this.water_res*3/4][this.water_res/2] = -1;
    //  this.water_u[this.water_res*3/4-1][this.water_res/2] = -1;
    }

    if(this.update_water % 2 == 0){
      for(let i = 1; i < this.water_res; i++){
        for(let j = 1; j < this.water_res; j++){
          if (this.water_v[i][j] < this.temp_terrain_2[i][j][1])
            continue;
          this.water_v[i][j] += (this.water_u[i-1][j]+this.water_u[i+1][j]+this.water_u[i][j-1]+this.water_u[i][j+1])/4 - this.water_u[i][j];
          //this.water_v[i][j] = Math.min(this.water_v[i][j], 1)
        }
      }
      for(let i = 1; i < this.water_res; i++){
        for(let j = 1; j < this.water_res; j++){
          this.water_v[i][j] *= 0.98;
          if (this.water_v[i][j] < this.temp_terrain_2[i][j][1])
            continue;

          this.water_u[i][j] += this.water_v[i][j];
          this.water_s[i][j] = vec3(this.water_s[i][j][0], this.water_v[i][j]+2.1, this.water_s[i][j][2]);
        }
      }
      const row_operation_3    = (s,p)   => this.water_s[0][Math.round(s*this.water_res)];
      const column_operation_3 = (t,p,s) => this.water_s[Math.round(t*this.water_res)][Math.round(s*this.water_res)];
    
      this.water.surface.update_points(caller, row_operation_3, column_operation_3);
    }
    this.update_water ++;

    // Draw terrain
    //this.shapes.ball.draw(caller, this.uniforms, Mat4.translation(0,5,0).times(Mat4.scale(5,5,5)), this.materials.reflective);
    
    //box
    this.shapes.square.draw( caller, this.uniforms,  Mat4.translation(0, 0.61, -5.02).times(Mat4.scale(5.02, 1.5, 5.02)), { ...this.materials.plastic, color: blackboard_color} );
    this.shapes.square.draw( caller, this.uniforms,  Mat4.translation(0, 0.61, 5.02).times(Mat4.scale(5.02, 1.5, 5.02)), { ...this.materials.plastic, color: blackboard_color} );
    this.shapes.square.draw( caller, this.uniforms,  Mat4.rotation(Math.PI/2,0,1,0).times(Mat4.translation(0, 0.61, 5.02).times(Mat4.scale(5.02, 1.5, 5.02))), { ...this.materials.plastic, color: blackboard_color} );
    this.shapes.square.draw( caller, this.uniforms,  Mat4.rotation(-Math.PI/2,0,1,0).times(Mat4.translation(0, 0.61, 5.02).times(Mat4.scale(5.02, 1.5, 5.02))), { ...this.materials.plastic, color: blackboard_color} );
    
    //snow
    this.ground.terrain.draw(caller, this.uniforms, Mat4.identity(), this.materials.snow)
    this.wall.snow.draw(caller, this.uniforms, Mat4.identity(), this.materials.snow);

    this.snowflakes = this.snowflakes.filter(s => s.pos[1] >2);
    this.water.surface.draw(caller, this.uniforms, Mat4.identity(), this.materials.water);
    this.wall.water.draw(caller, this.uniforms, Mat4.identity(), this.materials.water);
    this.shapes.axis.draw(caller, this.uniforms, Mat4.translation(0,5,0), this.materials.rgb);

    // glass
    this.shapes.cube.draw(caller, this.uniforms, Mat4.translation(0,5.1,0).times(Mat4.scale(5.01,6,5.01)), this.materials.reflective);

    

  }

  // Hardcoded value for testing purpose. Use parsed commands later.
  initialize_snowflakes() {
    // this.snowflakes.push(new Snowflake());
    // this.snowflakes[0].pos = vec3(7, 3, 0);

    // this.snowflakes.push(new Snowflake());
    // this.snowflakes[1].pos = vec3(7, 3, 3);

    // this.snowflakes.push(new Snowflake());
    // this.snowflakes[2].pos = vec3(8, 2, 1);

    // this.snowflakes.push(new Snowflake());
    // this.snowflakes[3].pos = vec3(6, 3, 3);
    for(let i = 0; i < 100; i++){
      this.snowflakes.push(new Snowflake());
    }

  }

  // Given a vec3 that represents the center of the snowflake, graph it.
  graph_snowflake(each_snowflake, caller) {
    // this.shapes.cube.draw(caller, this.uniforms, Mat4.translation(center[0], center[1], center[2]).times(Mat4.rotation(0, center[0], center[1], center[2])).times(Mat4.scale(0.05, 0.5, 0.02)),
    //     {...this.materials.plastic, color: color(1, 1, 1, 0.8)});
    // this.shapes.cube.draw(caller, this.uniforms, Mat4.translation(center[0], center[1], center[2]).times(Mat4.rotation(3.14 / 3, center[0], center[1], center[2])).times(Mat4.scale(0.05, 0.5, 0.02)),
    //     {...this.materials.plastic, color: color(1, 1, 1, 0.8)});
    // this.shapes.cube.draw(caller, this.uniforms, Mat4.translation(center[0], center[1], center[2]).times(Mat4.rotation(6.28 / 3, center[0], center[1], center[2])).times(Mat4.scale(0.05, 0.5, 0.02)),
    //     {...this.materials.plastic, color: color(1, 1, 1, 0.8)});

    const center = each_snowflake.pos;
    const angle = each_snowflake.angle;
    const spin_axis = each_snowflake.spin_axis;
    this.shapes.square.draw(caller, this.uniforms, Mat4.translation(...center).times(Mat4.rotation(angle, ...spin_axis)).times(Mat4.scale(.05, .05, .05)),
            {...this.materials.snowflake, color: color(.4, .4, .4, 1.0)});
  }

  clear_terrain() {
    super.init_terrain();
  }
  
  render_controls()
  {                                 
    // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Assignment 2: IK Engine";
    this.new_line();    
    // TODO: You can add your button events for debugging. (optional)
    this.key_triggered_button( "Debug", [ "Shift", "D" ], null );
    this.new_line();
    this.key_triggered_button( "Clear Terrain", [ "Shift", "C" ], this.clear_terrain );
    this.new_line();
    this.key_triggered_button( "Wind Blow Left", [ "Shift", "a" ], this.wind_blow_left );
    this.new_line();
  }
}

