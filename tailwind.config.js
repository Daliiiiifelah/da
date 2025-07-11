/** @type {import('tailwindcss').Config} */
    export default {
      content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
      ],
      theme: {
        extend: {
          colors: {
            primary: {
              DEFAULT: 'hsl(210, 100%, 50%)', // A vibrant blue
              hover: 'hsl(210, 100%, 40%)',
              dark: 'hsl(210, 100%, 30%)',
              light: 'hsl(210, 100%, 90%)',
              foreground: 'hsl(210, 100%, 95%)', // For text on primary background
            },
            background: 'hsl(220, 15%, 10%)', // Dark background
            card: 'hsl(220, 15%, 15%)', // Slightly lighter for cards
            'card-foreground': 'hsl(220, 10%, 85%)',
            popover: 'hsl(220, 15%, 12%)',
            'popover-foreground': 'hsl(220, 10%, 85%)',
            secondary: {
              DEFAULT: 'hsl(220, 10%, 30%)',
              hover: 'hsl(220, 10%, 40%)',
              foreground: 'hsl(220, 10%, 85%)',
            },
            muted: {
              DEFAULT: 'hsl(220, 10%, 25%)',
              foreground: 'hsl(220, 10%, 60%)',
            },
            accent: {
              DEFAULT: 'hsl(160, 100%, 50%)', // A teal/cyan accent
              hover: 'hsl(160, 100%, 40%)',
              foreground: 'hsl(220, 15%, 10%)',
            },
            destructive: {
              DEFAULT: 'hsl(0, 70%, 50%)',
              hover: 'hsl(0, 70%, 40%)',
              foreground: 'hsl(0, 0%, 95%)',
            },
            border: 'hsl(220, 10%, 25%)',
            input: 'hsl(220, 10%, 20%)',
            ring: 'hsl(210, 100%, 50%)', // For focus rings, same as primary
            info: 'hsl(190, 80%, 60%)', // Light blue for info text
            success: 'hsl(140, 70%, 50%)', // Green for success
            warning: 'hsl(40, 90%, 60%)', // Orange/Yellow for warning
            
            // Additional text colors for variety
            'text-blue-accent': 'hsl(200, 100%, 70%)',
            'text-cyan-accent': 'hsl(180, 100%, 60%)',
            'text-green-accent': 'hsl(140, 80%, 60%)',
            'text-yellow-accent': 'hsl(50, 100%, 60%)',
            'text-pink-accent': 'hsl(330, 100%, 70%)',
            'text-purple-accent': 'hsl(270, 100%, 75%)',
          },
          borderRadius: {
            lg: "0.5rem",
            md: "calc(0.5rem - 2px)",
            sm: "calc(0.5rem - 4px)",
          },
        },
      },
      plugins: [],
    }
