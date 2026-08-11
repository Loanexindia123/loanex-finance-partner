import { definePreset, palette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Admin Web PrimeNG preset — Aura base, deliberately distinct from the
 * customer-web brand palette so the admin surface reads as a separate
 * "control room" product, not a re-skin of the storefront.
 * Primary #4F46E5 (indigo) · Sidebar/surface #0F172A (slate-950) accents.
 */
const primaryScale = palette('#4F46E5') as Record<number, string>;
const surfaceScale = palette('#F1F5F9') as Record<number, string>;

export const AdminPreset = definePreset(Aura, {
  primitive: {
    indigo: primaryScale,
    slate: surfaceScale,
  },
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
    colorScheme: {
      light: {
        primary: {
          color: '#4F46E5',
          contrastColor: '#FFFFFF',
          hoverColor: '#4338CA',
          activeColor: '#3730A3',
        },
        highlight: {
          background: 'rgba(79, 70, 229, 0.1)',
          focusBackground: 'rgba(79, 70, 229, 0.16)',
          color: '#4F46E5',
          focusColor: '#4F46E5',
        },
        surface: {
          0: '#FFFFFF',
          50: '#F8FAFC',
          100: '{slate.100}',
          200: '{slate.200}',
          300: '{slate.300}',
          400: '{slate.400}',
          500: '{slate.500}',
          600: '{slate.600}',
          700: '{slate.700}',
          800: '{slate.800}',
          900: '{slate.900}',
          950: '{slate.950}',
        },
        formField: {
          background: '#FFFFFF',
          disabledBackground: '#F1F5F9',
          filledBackground: '#F8FAFC',
          filledHoverBackground: '#F1F5F9',
          filledFocusBackground: '#FFFFFF',
          borderColor: '#E2E8F0',
          hoverBorderColor: '#CBD5E1',
          focusBorderColor: '#4F46E5',
          invalidBorderColor: '#DC2626',
          color: '#0F172A',
          disabledColor: '#94A3B8',
          placeholderColor: '#94A3B8',
          invalidPlaceholderColor: '#DC2626',
          floatLabelColor: '#64748B',
          floatLabelFocusColor: '#4F46E5',
          floatLabelActiveColor: '#64748B',
          floatLabelInvalidColor: '#DC2626',
          iconColor: '#64748B',
          shadow: '0 0 0 0 rgba(0,0,0,0)',
        },
        content: {
          background: '#FFFFFF',
          hoverBackground: '#F8FAFC',
          borderColor: '#E2E8F0',
          color: '#0F172A',
          hoverColor: '#0F172A',
        },
        text: {
          color: '#0F172A',
          hoverColor: '#0F172A',
          mutedColor: '#64748B',
          hoverMutedColor: '#475569',
        },
      },
    },
  },
  components: {
    button: {
      root: {
        borderRadius: '999px',
        paddingX: '1.05rem',
        paddingY: '0.55rem',
        gap: '0.4rem',
        sm: {
          fontSize: '0.8125rem',
          paddingX: '0.85rem',
          paddingY: '0.4rem',
        },
      },
    },
    toggleswitch: {
      root: {
        width: '2.75rem',
        height: '1.5rem',
        borderRadius: '999px',
        gap: '0.1875rem',
        borderWidth: '0',
      },
      handle: {
        size: '1.125rem',
        borderRadius: '999px',
      },
    },
    dialog: {
      root: {
        borderRadius: '16px',
        shadow: '0 22px 50px -16px rgb(15 23 42 / 0.28)',
      },
      header: {
        padding: '1.15rem 1.25rem 0.85rem',
      },
      title: {
        fontWeight: '700',
        fontSize: '1.05rem',
      },
      content: {
        padding: '0.85rem 1.25rem 1rem',
      },
      footer: {
        padding: '0.9rem 1.25rem 1.15rem',
        gap: '0.5rem',
      },
    },
    confirmdialog: {
      icon: {
        size: '1.75rem',
      },
    },
  },
});
