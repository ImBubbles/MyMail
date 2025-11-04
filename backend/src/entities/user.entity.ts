import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  username: string;

  @Column({ type: 'text' })
  password: string;

  @Column({ type: 'text' })
  salt: string;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  encryptionKey: string | null; // Encrypted user-specific encryption key (encrypted with master key)

  @Column({ type: 'text', nullable: true })
  pgpPublicKey: string | null; // PGP public key (stored in plain text, can be shared)

  @Column({ type: 'text', nullable: true })
  pgpPrivateKey: string | null; // Encrypted PGP private key (encrypted with user's encryption key)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

