import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { RoleName } from './enums';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn({ unsigned: true })
  id!: number;

  @Column({ type: 'enum', enum: RoleName, unique: true })
  name!: RoleName;
}
