import { useEffect } from "react";
import CategoryItem from "../components/CategoryItem";
import { useProductStore } from "../stores/useProductStore";
import FeaturedProducts from "../components/FeaturedProducts";

const categories = [
	{ href: "/calculator", name: "Calculator", imageUrl: "/calc.jpg" },
	{ href: "/arduino", name: "Arduino", imageUrl: "/arduino.jpg" },
	{ href: "/drafter", name: "Drafter", imageUrl: "/drafter.jpg" },
	{ href: "/labcoat", name: "Labcoat", imageUrl: "/labcoat.jpg" },
	{ href: "/raspberrypi", name: "Raspberry Pi", imageUrl: "/raspberrypi.jpg" },
	{ href: "/books", name: "Books", imageUrl: "/IoT_and_Machine_Learning_Book.jpg" },
	{ href: "/breadboard", name: "Breadboard", imageUrl: "/breadboard.jpg" },
];

const HomePage = () => {
	const { fetchFeaturedProducts, products, isLoading } = useProductStore();

	useEffect(() => {
		fetchFeaturedProducts();
	}, [fetchFeaturedProducts]);

	return (
		<div className='relative min-h-screen text-white overflow-hidden'>
			<div className='relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16'>
				<h1 className='text-center text-5xl sm:text-6xl font-bold text-blue-400 mb-4'>
					Explore Our Categories
				</h1>
				<p className='text-center text-xl text-gray-300 mb-12'>
					Discover Second Hand Engineering Suppplies at unbeatable prices!
				</p>

				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
					{categories.map((category) => (
						<CategoryItem category={category} key={category.name} />
					))}
				</div>

				{!isLoading && products.length > 0 && <FeaturedProducts featuredProducts={products} />}
			</div>
		</div>
	);
};
export default HomePage;