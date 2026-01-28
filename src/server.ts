import { createApp } from "./app/app";
import { env } from "./config/env";
import { connectDB } from "./config/connectDB";


async function bootstrap() {
  await connectDB();

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT}`);
  });
}

bootstrap();



