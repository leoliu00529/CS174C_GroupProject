import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Cube_Texture, Component } = tiny;


function euler_update(p, dt) {
  p.acc = p.ext_force.times( 1.0 / p.mass );
  p.pos = p.pos.plus(p.vel.times(dt));
  p.vel = p.vel.plus(p.acc.times(dt));
}

function symplectic_update(p, dt) {
  p.acc = p.ext_force.times( 1.0 / p.mass );
  p.vel = p.vel.plus(p.acc.times(dt));
  p.pos = p.pos.plus(p.vel.times(dt));
}

function verlet_update(p, dt) {
  if (p.prev_pos.equals(p.pos)) {
    symplectic_update(p, dt);
  }
  else {
    let tmp_pos = p.pos;
    p.pos = p.pos.times(2).minus(p.prev_pos).plus(p.ext_force.times(dt ** 2 * 1.0 / p.mass ));
    p.prev_pos = tmp_pos;
  }
}


class Particle {
  constructor(x, y, z, m) {
    this.mass = m;
    this.pos = vec3(x, y, z);
    this.prev_pos = vec3(x, y, z);
    this.vel = vec3(0, 0, 0);
    this.acc = vec3(0, 0, 0);
    this.ext_force = vec3(0, 0, 0);
    this.controlled = false;
  }

  update(dt, method) {
    if (!this.controlled) {
      if (method === "euler") {
        euler_update(this, dt);
      }
      else if (method === "symplectic") {
        symplectic_update(this, dt);
      }
      else if (method === "verlet") {
        verlet_update(this, dt);
      }
      else {
        throw "Invalid update method"
      }
    }
  }
};



function calculate_ve_forces(s) {
  let d_ij = s.particle_2.pos.minus(s.particle_1.pos);
  let fs_ij = d_ij.normalized().times(s.ks * (d_ij.norm() - s.rest_length));
  let fd_ij = d_ij.normalized().times(s.kd * ((s.particle_2.vel.minus(s.particle_1.vel)
                              .dot(d_ij.normalized()))));
  
  return fs_ij.plus(fd_ij);
}



export 
const Spring = 
  class Spring {
    constructor(p1, p2, ks, kd, length) {
      this.particle_1 = p1;
      this.particle_2 = p2;
      this.ks = ks;
      this.kd = kd;
      this.rest_length = length;
    }

    update() {
      const fe_ij = calculate_ve_forces(this);
      this.particle_1.ext_force.add_by(fe_ij);
      this.particle_2.ext_force.subtract_by(fe_ij);
    }
  };



export 
const Flag = 
  class Flag {
    constructor(x_seg, y_seg, rest_dist) {
      this.cloth_transform = Mat4.translation(-3, 4, 2);
      this.particles = [];
      this.springs = [];
      this.g_acc = vec3(0, -9.8, 0);
      this.normal = vec3(0, 1, 0);
      this.method = "verlet";
      this.dist = rest_dist;
      this.ks = 1000;
      this.kd = 10;
      this.particle_mass = 0.03;
      this.wind = true;

      this.h = x_seg;
      this.w = y_seg;

      this.wind_dir = Mat4.rotation(Math.PI/4, 0,1,0);
      // this.surface = [];

      this.create_particles(x_seg, y_seg);
      this.create_springs(x_seg, y_seg);

     

    }

    toggle_wind() {
      this.wind = !this.wind;
      if (!this.wind) {
        this.reset_velocities();
      }
    }

    update_wind_dir(wind_dir) {
      this.wind_dir = wind_dir;
    }

    reset_velocities() {
      for (let i = 0; i < this.particles.length; i++) {
        this.particles[i].acc = vec3(0, 0, 0);
        this.particles[i].vel = vec3(0, 0, 0);
      }

      for (let i = 0; i < this.springs.length; i++) {
        this.particles[i].acc = vec3(0, 0, 0);
        this.particles[i].vel = vec3(0, 0, 0);
      }
    }

    create_particles (w, h) {
      this.particles = [];
      for (let v = 0; v <= h; v++) {
        //this.surface.push(new Array(this.w+1));
        for (let u = 0; u <= w; u++) {
          let p = new Particle(u * this.dist, v * this.dist, 0, this.particle_mass);
          if (u == 0) {
            p.controlled = true;
          }
          this.particles.push(p);
          //this.surface[v][u] = vec3(u*this.dist, v*this.dist, 0);
      }

      // //this.water_u[this.water_res*3/4][this.water_res/2] = -1;
      // const row_operation    = (s,p)   => this.surface[0][Math.round(s*this.w)];
      // const column_operation = (t,p,s) => this.surface[Math.round(0*this.h)][Math.round(s*this.w)];
      // this.flag_surface = new defs.Grid_Patch(this.h, this.w, row_operation, column_operation);
    } 
  }

    create_springs(w, h) {
      this.springs = [];

      function index(u, v) {
        return u + v * (w + 1);
      }

      for (let v = 0; v < h; v++ ) {
        for (let u = 0; u < w; u++ ) {
          this.springs.push( new Spring(this.particles[index(u,v)], 
                                        this.particles[index(u, v+1)],
                                        this.ks, this.kd, this.dist));
          this.springs.push( new Spring(this.particles[index(u,v)], 
                                        this.particles[index(u+1, v)],
                                        this.ks, this.kd, this.dist));
    
        }
      }
    
      for (let u = w, v = 0; v < h; v++) {
        this.springs.push( new Spring(this.particles[index(u,v)], 
                                        this.particles[index(u, v+1)],
                                        this.ks, this.kd, this.dist));
      }
    
      for (let v = h, u = 0; u < w; u++) {
        this.springs.push( new Spring(this.particles[index(u,v)], 
                                        this.particles[index(u+1, v)],
                                        this.ks, this.kd, this.dist));
      }
    }


    update(dt) {
      for (const p of this.particles) {
        p.ext_force = this.g_acc.times(p.mass);
        if (this.wind) {
          let wind_strength = Math.cos( dt / 7000 ) * 1 + 2;
          let wind_force = vec3(Math.sin(dt / 2000), 0, 0).normalized().times(wind_strength);
          wind_force = (this.wind_dir).times(wind_force)
          p.ext_force.add_by(wind_force);
        } 
      }

      for (const s of this.springs) {
        s.update();
      }

      for (const p of this.particles) {
        p.update(dt, this.method);
      }
    }

    draw(webgl_manager, uniforms, shapes, materials) {
      const blue = color( 0,0,1,1), red = color( 1,0,0,1 ), flag_color = color( 0.8, 0, 0.3, 1 );

      for (const p of this.particles) {
        const pos = p.pos;
        let model_transform = Mat4.scale(0, 0, 0);
        model_transform.pre_multiply(Mat4.translation(pos[0], pos[1], pos[2]));
        model_transform.pre_multiply(this.cloth_transform);
        shapes.ball.draw(webgl_manager, uniforms, model_transform, { ...materials.plastic, color: blue });
      }

      for (const s of this.springs) {
        const p1 = s.particle_1.pos;
        const p2 = s.particle_2.pos;
        const len = (p2.minus(p1)).norm();
        const center = (p1.plus(p2)).times(0.5);

        let model_transform = Mat4.scale(0.05, len / 2, 0.05);

        const p = p1.minus(p2).normalized();
        let v = vec3(0, 1, 0);
        if (Math.abs(v.cross(p).norm()) < 0.1) {
          v = vec3(0, 0, 1);
          model_transform = Mat4.scale(0.05, 0.05, len / 2);
        }
        const w = v.cross(p).normalized();

        const theta = Math.acos(v.dot(p));
        model_transform.pre_multiply(Mat4.rotation(theta, w[0], w[1], w[2]));
        model_transform.pre_multiply(Mat4.translation(center[0], center[1], center[2]));
        model_transform.pre_multiply(this.cloth_transform);
        shapes.box.draw(webgl_manager, uniforms, model_transform, { ...materials.pure_color, color: flag_color });
      }

      //this.flag_surface.draw(webgl_manager, uniforms, Mat4.identity(), { ...materials.pure_color, color: flag_color });
      
      let model_transform = Mat4.scale(0.05, 0.05, 2.5);
      model_transform.pre_multiply(Mat4.rotation(Math.PI / 2, 1, 0, 0));
      model_transform.pre_multiply(Mat4.translation(0, -.5, 0));
      model_transform.pre_multiply(this.cloth_transform);
      shapes.cylinder.draw(webgl_manager, uniforms, model_transform, { ...materials.plastic, color: color(0,0,0,1) });

    }
  };
