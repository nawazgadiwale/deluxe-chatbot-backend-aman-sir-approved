const { default: axios } = require("axios")
const fs = require("fs")
const path = require("path")

const DATA_DIR = path.join(__dirname, "../data");
const STEGIENCE_PATH = path.join(DATA_DIR, "stegience-products.json");
const JASANI_PATH = path.join(DATA_DIR, "jasani-products.json")

const readJsonSafe = (filePath) => {
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, "utf-8"))
}

const addAllStegienceProducts = async (req, res) => {
    try {
        // 🔒 ensure directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        const response = await axios.get(
            `${process.env.STEGIENCE_BASE_URL}/products?api_key=${process.env.STEGEINCE_API_KEY}&per_page=3000`,
            {
                params: {
                    api_key: process.env.STEGEINCE_API_KEY
                }
            }
        );

        const products = response.data?.data?.products;

        if (!Array.isArray(products)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Stegience response format"
            });
        }

        const filteredProducts = products.map(product => {
            const sku = product.variants?.[0]?.default_code || null;

            return {
                id: product.id,
                source: "stegience",
                name: product.name,
                description: product.description,
                image_url: product.image_url,
                category_id: product.category?.id,
                category_name: product.category?.name,
                sku,
                uuid: `${sku}-${product.name}-${product.id}`.toLowerCase().replace(/\s+/g, "-")
            };
        });

        fs.writeFileSync(
            STEGIENCE_PATH,
            JSON.stringify(filteredProducts, null, 2),
            "utf-8"
        );

        res.status(200).json({
            success: true,
            message: "Stegience products synced successfully",
            count: filteredProducts.length
        });
    } catch (error) {
        // console.error("Error fetching Stegience Products:", error);

        res.status(500).json({
            success: false,
            message: "Failed to fetch products from Stegience"
        });
    }
};

const addAllJasaniProducts = async (req, res) => {
    try {
        // ensure directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true});
        }
        const response = await axios.get(
            `${process.env.JASANI_BASE_URL}/${process.env.JASANI_API_KEY}`
        )

        const products = response.data;

        if (!Array.isArray(products)) {
            return res.status(400).json({
                success: false,
                message: "Invalid Jasani response format"
            })
        }

        const filteredProducts = products.map(product => {
            return {
                id: product.id,
                source: "jasani",
                name: product.name,
                description: product.description_sale,
                image_url: product.image_url,
                category_id: product.public_categ_ids?.[0].id,
                category_name: product.public_categ_ids?.[0].name,
                sku: product.default_code,
                uuid: `${product.default_code}-${product.name}-${product.id}`.toLowerCase().replace(/\s+/g, "-")
            }
        })

        fs.writeFileSync(
            JASANI_PATH,
            JSON.stringify(filteredProducts, null, 2),
            "utf-8"
        )

        res.status(200).json({
            success: true,
            products: "Jasani products synced successfully",
            count: filteredProducts.length,
        })
    } catch (error) {
        console.error("Error fetching Jasani Products:", error)
        res.status(500).json({
            success: false,
            message: "failed to fetch products from Jasani"
        })
    }
}

// const getAllProducts = (req, res) => {
//     try {
//         const { page = 1, limit = 20, search = "", category} = req.query;

//         const pageNum = Number(page);
//         const limitNum = Number(limit);

//         let stegienceProducts = readJsonSafe(STEGIENCE_PATH);
//         let jasaniProducts = readJsonSafe(JASANI_PATH);

//         if (search) {
//             const q = search.toLowerCase();
           
//             const matchSearch = (p) => {
//                 const name = typeof p.name === "string" ? p.name.toLowerCase() : "";
//                 const sku = typeof p.sku === "string" ? p.sku.toLowerCase() : ""

//                 return name.includes(q) || sku.includes(q)
//             }

//             stegienceProducts = stegienceProducts.filter(matchSearch)
//             jasaniProducts = jasaniProducts.filter(matchSearch)
//         }

//         if (category) {
//             stegienceProducts = stegienceProducts.filter(
//                 p => p.category_name === category
//             )
//             jasaniProducts = jasaniProducts.filter(
//                 p => p.category_name === category         
//             )
//         }

//         const halfLimit = Math.floor(limitNum / 2);

//         const stegienceSlice = stegienceProducts.slice(
//             (pageNum - 1) * halfLimit,
//             pageNum * halfLimit
//         )

//         const jasaniSlice = jasaniProducts.slice(
//             (pageNum - 1) * halfLimit,
//             pageNum * halfLimit
//         )

//         const finalProducts = [...stegienceSlice, ...jasaniSlice]

//         res.status(200).json({
//             success: true,
//             page: pageNum,
//             limit: limitNum,
//             count: stegienceProducts.length + jasaniProducts.length,
//             returned: finalProducts.length,
//             products: finalProducts,
//         })
//     } catch (error) {
//         console.error("Error getting all products:", error)
//         res.status(500).json({
//             success: false,
//             message: "Failed to get products"
//         })
//     }
// }

const getAllProducts = (req, res) => {
    try {
        const { page = 1, limit = 20, search = "", category } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;

        let stegience = readJsonSafe(STEGIENCE_PATH);
        let jasani = readJsonSafe(JASANI_PATH);

        if (search) {
            const q = search.toLowerCase();
            const match = (p) =>
                (p.name || "").toLowerCase().includes(q) ||
                (p.sku || "").toLowerCase().includes(q);

            stegience = stegience.filter(match);
            jasani = jasani.filter(match);
        }

        if (category) {
            stegience = stegience.filter(p => p.category_name === category);
            jasani = jasani.filter(p => p.category_name === category);
        }

        const half = Math.floor(limitNum / 2);

        let stegSlice = stegience.slice(offset, offset + half);
        let jasaniSlice = jasani.slice(offset, offset + half);

        let remaining = limitNum - (stegSlice.length + jasaniSlice.length);

        if (remaining > 0) {
            if (stegSlice.length < half) {
                jasaniSlice.push(
                    ...jasani.slice(offset + half, offset + half + remaining)
                );
            } else {
                stegSlice.push(
                    ...stegience.slice(offset + half, offset + half + remaining)
                );
            }
        }

        const products = [...stegSlice, ...jasaniSlice];

        res.status(200).json({
            success: true,
            page: pageNum,
            limit: limitNum,
            count: stegience.length + jasani.length,
            returned: products.length,
            products,
        });
    } catch (error) {
        console.error("Error getting all products:", error)
        res.status(500).json({
            success: false,
            message: "Failed to get products"
        })
    }
}

const getIndividualProductDetails = (req, res) => {
  try {
      const { uuid } = req.params;

    if (!uuid) {
        return (res.status(400).json({
            success: false,
            message: "UUID is required!"
        }))
    }

    const stegienceProducts = readJsonSafe(STEGIENCE_PATH);
    const jasaniProducts = readJsonSafe(JASANI_PATH)

    const allProducts = [...stegienceProducts, ...jasaniProducts];

    const product = allProducts.find(
        p => p.uuid === uuid
    )

    if (!product) {
        return res.status(404).json({
            success: false,
            message: "Product not found!"
        })
    }

    res.status(200).json({
        success: true,
        product: product
    })
  } catch (error) {
    console.error("Error getting product by UUID:", error)
    res.status(500).json({
        success: false,
        message: "Failed to fetch product details!"
    })
  }
}

module.exports = { addAllStegienceProducts, addAllJasaniProducts, getAllProducts, getIndividualProductDetails }