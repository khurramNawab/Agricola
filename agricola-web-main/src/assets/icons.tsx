import * as React from 'react';
import {
  FaStarHalfAlt,
  FaFacebook,
  FaTwitter,
  FaInstagram,
  FaLeaf,
  FaBox,
  FaHeart,
  FaPlus,
  FaSearch,
  FaShoppingCart,
  FaUser,
  FaStar,
  FaMinus,
  FaBoxes,
  FaTruck,
  FaCheckCircle,
} from 'react-icons/fa';

// Added explicit props type to allow optional titleId
type IconProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
  titleId?: string;
};

// Brand logo. Renders the AgriCola badge from /public/agricola_logo.svg.
// Kept the original export name + (title, className) props so every existing
// usage (header, search overlay, order tracking, admin sidebar/login, …) keeps
// working unchanged — it's now an <img> instead of an inline wordmark.
type LogoProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  title?: string;
  titleId?: string;
};

export const AgriWordmark = React.forwardRef<HTMLImageElement, LogoProps>(function AgriWordmark(
  { title = 'AgriCola', className, alt, ...rest },
  ref
) {
  return (
    <img
      ref={ref}
      src="/agricola_logo.svg"
      alt={alt ?? title}
      className={className}
      {...rest}
    />
  );
});

// Removed custom inline SVG components: SearchIcon, CartIcon, UserIcon, StarIcon

// Wrapped react-icons with optional title support (titleId unused for library icons)
const withA11y =
  <P extends object>(Comp: React.ComponentType<P & React.SVGProps<SVGSVGElement>>, defaultLabel: string) =>
  React.forwardRef<SVGSVGElement, IconProps>(function Wrapped({ title, ...rest }, ref) {
    return (
      <Comp
        ref={ref}
        role="img"
        aria-label={title || defaultLabel}
        aria-hidden={title ? undefined : true}
        {...(rest as unknown as P)}
      />
    );
  });

// New react-icons based replacements
export const SearchIcon = withA11y(FaSearch, 'Search');
export const CartIcon = withA11y(FaShoppingCart, 'Cart');
export const UserIcon = withA11y(FaUser, 'User');
export const StarIcon = withA11y(FaStar, 'Star');
export const StarHalfIcon = withA11y(FaStarHalfAlt, 'Half star');
export const FacebookIcon = withA11y(FaFacebook, 'Facebook');
export const TwitterIcon = withA11y(FaTwitter, 'Twitter');
export const InstagramIcon = withA11y(FaInstagram, 'Instagram');
export const LeafIcon = withA11y(FaLeaf, 'Leaf');
export const BoxIcon = withA11y(FaBox, 'Box');
export const HeartIcon = withA11y(FaHeart, 'Heart');
export const PlusIcon = withA11y(FaPlus, 'Plus');
export const MinusIcon = withA11y(FaMinus, 'Minus');
export const FavouriteIcon = withA11y(FaHeart, 'Favourite');
export const InventoryIcon = withA11y(FaBoxes, 'Inventory');
export const LocalShippingIcon = withA11y(FaTruck, 'Local shipping');
export const VerifiedIcon = withA11y(FaCheckCircle, 'Verified');

// Optional aggregated export for future icons.
// eslint-disable-next-line react-refresh/only-export-components
export const icons = {
  AgriWordmark,
  SearchIcon,
  CartIcon,
  UserIcon,
  StarIcon,
  StarHalfIcon,
  FacebookIcon,
  TwitterIcon,
  InstagramIcon,
  LeafIcon,
  BoxIcon,
  HeartIcon,
  PlusIcon,
  MinusIcon,
  FavouriteIcon,
  InventoryIcon,
  LocalShippingIcon,
  VerifiedIcon,
};

// eslint-disable-next-line react-refresh/only-export-components
export default icons;

