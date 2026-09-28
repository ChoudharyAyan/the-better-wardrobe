// Single Vercel function for every /api/* route (see vercel.json rewrites); static files in dist/ are served by Vercel's CDN.
import {createHandler} from '../server.mjs';
export default createHandler();
