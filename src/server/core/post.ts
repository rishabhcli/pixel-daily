import { createDailyPost } from './store';
import { utcDay } from '../../shared/core';

/** Posts today's puzzle (once per UTC day). */
export const createPost = async () => createDailyPost(utcDay());
