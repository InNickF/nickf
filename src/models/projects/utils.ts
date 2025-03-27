import type { Technologies } from ".";

interface GetTechURLParams {
  tech: Technologies;
}
export const getTechURL = ({ tech }: GetTechURLParams) => {
  const urls: Record<Technologies, string> = {
    "Adobe XD": "https://helpx.adobe.com/support/xd.html",
    "Next.JS": "https://nextjs.org/",
    Figma: "https://www.figma.com/",
    Blender: "https://www.blender.org/",
    Illustrator: "https://www.adobe.com/products/illustrator.html",
    Laravel: "https://laravel.com/",
    PHP: "https://www.php.net/",
    Photoshop: "https://www.adobe.com/products/photoshop.html",
    React: "https://reactjs.org/",
    TailwindCSS: "https://tailwindcss.com/",
    TypeScript: "https://www.typescriptlang.org/",
    VueJS: "https://vuejs.org/",
    Wordpress: "https://wordpress.org/",
    "After Effects": "https://www.adobe.com/products/aftereffects.html",
    Docker: "https://www.docker.com/",
    Nuxt: "https://nuxtjs.org/",
    TurboRepo: "https://turbo.build/repo/docs",
  };
};
