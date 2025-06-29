import type { Route } from "./+types/home";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { message: context.cloudflare.env.R2_BUCKET_NAME };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <div>{loaderData.message}</div>;
}
