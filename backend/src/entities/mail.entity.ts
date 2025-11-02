import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('mail')
export class Mail {
  @PrimaryColumn({ type: 'uuid' })
  uid: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  recipient: string;

  @Column({ type: 'varchar', length: 255 })
  sender: string;

  @Column({ type: 'jsonb' })
  headers: Record<string, any>;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn()
  createdAt: Date;
}

