const Job = require('../models/Job')
const Quote = require('../models/Quote')
// const MANAGER_BASE_URL = process.env.NEXT_PUBLIC_MANAGER_BASE_URL;
// const API_KEY = process.env.NEXT_PUBLIC_API_KEY
// const API_KEY_2 = process.env.NEXT_PUBLIC_API_KEY_2

// const fields = [
//   // "Image",
//   // "Attachment",
//   "IssueDate",
//   "DueDate",
//   "Reference",
//   "SalesQuote",
//   // "SalesOrder",
//   "Customer",
//   "Description",
//   "Project",
//   "Division",
//   // "ClosedInvoice",
//   // "WithholdingTax",
//   // "Discount",
//   "InvoiceAmount",
//   // "CostOfSales",
//   "BalanceDue",
//   // "DaysToDueDate",
//   "DaysOverdue",
//   "Status",
//   "Timestamp",
// ]

// const salesInvoices = async (skip = 0, pageSize = 20, term = "") => {
//   try {
//     // Build fields query string
//     const queryString = fields.map((f) => `fields=${encodeURIComponent(f)}`).join("&");

//     // Add search term if exists
//     const termParam = term ? `&term=${encodeURIComponent(term)}` : "";

//     const url = `${MANAGER_BASE_URL}/sales-invoices?skip=${skip}&pageSize=${pageSize}${termParam}&${queryString}`;

//     const response = await axios.get(url, {
//       headers: {
//         Accept: "application/json",
//         "X-API-KEY": API_KEY,
//       },
//     });

//     return {
//       totalRecords: response.data.totalRecords || response.data.length || 0,
//       salesInvoices: response.data || [],
//     };
//   } catch (error) {
//     // console.error("Error while fetching sales invoices:", error.message);
//     if (error.response) {
//       console.error("Response:", error.response.data);
//     }
//     return { totalRecords: 0, salesInvoices: [] };
//   }
// };

// function to create new order 
const createNewOrder = async (req, res) => {
   try {
      // body params
      const { createdBy, uuid, invoiceNumber, invoiceDate, emirates, contact_person, companyName, division, emailId, item, main_category,
         salesPerson, source, type, modes, mobileNumber, delivery_address, billing_address, assignToDepartment, designer, production,
         operation, description, instruction, payment_status, delivery_date, delivery_time, category, finishing_instruction, multiple_items
      } = req.body

      // below fields are mandatory
      if (
         !createdBy || !invoiceNumber || !invoiceDate || !uuid ||
         !billing_address || !assignToDepartment
      ) {
         return res.status(400).json({ message: "All required fields must be filled!" })
      }

      // only Designer department allowes
      if (assignToDepartment !== "Designer") {
         return res.status(400).json({ message: "New orders can only be assigned to the Designer department!" })
      }

      // if order id exists 
      const existeduuid = await Job.findOne({ uuid })
      if (existeduuid) {
         return res.status(400).json({ message: "The Invoice is Already Created!" })
      }

      // let designerVal = null,
      //    productionVal = null,
      //    operationVal = null

      // if (assignToDepartment === "Designer") designerVal = designer
      // if (assignToDepartment === "Production") productionVal = production
      // if (assignToDepartment === "Operation") operationVal = operation

      // create new order
      const newJob = new Job({
         createdBy,
         uuid,
         invoiceNumber,
         invoiceDate,
         emirates,
         contact_person,
         division,
         companyName,
         emailId,
         item,
         salesPerson,
         source,
         type,
         modes,
         mobileNumber,
         main_category,
         billing_address,
         delivery_address,
         assignToDepartment: "Designer",
         designer,
         // designer: designerVal,
         // production: productionVal,
         // operation: operationVal,
         description,
         category,
         instruction,
         payment_status,
         delivery_date,
         delivery_time,
         finishing_instruction,
         multiple_items
      })

      // save the orders data
      const savedJob = await newJob.save()

      // return the status
      res.status(200).json({
         success: true,
         message: "Order created successfully!",
         job: savedJob
      })
   } catch (error) {
      // if error console the response and return the internal server error
      console.error('Error creating order:', error.message)
      res.status(500).json({ message: "Internal Server Error" })
   }
}

// function of get all order list with search and filters
// const getAllOrders = async (req, res) => {
//    try {
//       // pass query params for search and filter
//       const { page = 1, limit = 10, search = "", main_category, department, salesPerson, orderStatus, designer, finishing, operation } = req.query

//       // create pipeline variable
//       const pipeline = []

//       // if search 
//       if (search) {
//          // if search through the invoice number
//          if (!isNaN(search)) {
//             pipeline.push({
//                $match: {
//                   $expr: {
//                      $regexMatch: {
//                         input: { $toString: "$invoiceNumber" },
//                         regex: search,
//                         options: "i"
//                      }
//                   }
//                }
//             })
//          }
//          // else search through vontact_person and emailid
//          else {
//             pipeline.push({
//                $match: {
//                   $or: [
//                      { contact_person: { $regex: search, $options: "i" } },
//                      { emailId: { $regex: search, $options: "i" } },]
//                }
//             })
//          }
//       }

//       // for category filter
//       if (main_category) pipeline.push({ $match: { main_category } })

//       // for department filter
//       if (department) pipeline.push({ $match: { division: department } });

//       // if sales person filter
//       if (salesPerson) pipeline.push({ $match: { salesPerson } });

//       // order status fiter like sales, design, production, operantion and complete
//       if (orderStatus) {
//          if (['Designer', 'Production', 'Finishing'].includes(orderStatus)) {
//             pipeline.push({ $match: { assignToDepartment: orderStatus } })
//          } else if (orderStatus === 'Operation') {
//             pipeline.push({
//                $match: {
//                   assignToDepartment: 'Operation',
//                   isOperationCompleted: { $ne: true }
//                }
//             })
//          } else if (orderStatus === 'Completed') {
//             pipeline.push({ $match: { isOperationCompleted: true } })
//          }
//       };

//       // designer person filter
//       if (designer) pipeline.push({ $match: { designer } })

//       // // production person filter
//       // if (production) pipeline.push({ $match: { production } })

//       // finishing person filter
//       if (finishing) pipeline.push({ $match: { finishing } })

//       // operation person filter
//       if (operation) pipeline.push({ $match: { operation } })

//       // sort skip and limit
//       pipeline.push({ $sort: { createdAt: -1 } });
//       pipeline.push({ $skip: (page - 1) * parseInt(limit) });
//       pipeline.push({ $limit: parseInt(limit) });

//       // aggregate the filter and search
//       const orders = await Job.aggregate(pipeline);

//       // count pipeline
//       const countPipeline = pipeline.filter(stage => !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage));
//       countPipeline.push({ $count: "total" });

//       // count total result
//       const countResult = await Job.aggregate(countPipeline);
//       const total = countResult.length > 0 ? countResult[0].total : 0;

//       // return the response
//       res.status(200).json({
//          success: true,
//          message: "Orders Data!",
//          data: orders,
//          total,
//          page: parseInt(page),
//          pages: Math.ceil(total / limit)
//       })
//    } catch (error) {
//       // if error console the response and return the internal server error
//       console.error('Error getting orders:', error.message)
//       res.status(500).json({ message: "Internal Server Error" })
//    }
// }

// functiion to update of sales data
// const updateSalesData = async (req, res) => {
//    try {
//       // take uuid in params
//       const { uuid } = req.params

//       // body params
//       const { invoiceNumber, delivery_address, billing_address, assignToDepartment, designer,
//          production, operation, description, instruction, modes, payment_status, delivery_date, delivery_time,
//          category, finishing_instruction, multiple_items
//       } = req.body

//       // if id or invoice number is not filled
//       if (!uuid || !invoiceNumber) {
//          return res.status(400).json({ message: "All required fields must be filled!" })
//       }

//       // check order is found by id or not
//       const existingJob = await Job.findOne({ uuid })

//       // if order is not present
//       if (!existingJob) {
//          return res.status(404).json({ message: "Order not found!" })
//       }

//       existingJob.billing_address = billing_address || existingJob.billing_address
//       existingJob.delivery_address = delivery_address || existingJob.delivery_address
//       existingJob.assignToDepartment = assignToDepartment || existingJob.assignToDepartment
//       existingJob.description = description || existingJob.description
//       existingJob.instruction = instruction || existingJob.instruction
//       existingJob.modes = modes || existingJob.modes
//       existingJob.payment_status = payment_status || existingJob.payment_status
//       existingJob.delivery_date = delivery_date || existingJob.delivery_date
//       existingJob.delivery_time = delivery_time || existingJob.delivery_time
//       existingJob.category = category || existingJob.category
//       existingJob.finishing_instruction = finishing_instruction || existingJob.finishing_instruction
//       existingJob.multiple_items = multiple_items || existingJob.multiple_items

//       if (assignToDepartment === "Designer" && designer) {
//          existingJob.designer = designer
//       }
//       if (assignToDepartment === "Production" && production) {
//          existingJob.production = production
//       }
//       if (assignToDepartment === "Operation" && operation) {
//          existingJob.operation = operation
//       }

//       // save the updated data
//       const updateJob = await existingJob.save()

//       // return the response
//       res.status(200).json({
//          success: true,
//          message: "Order updated successfully!",
//          job: updateJob
//       })
//    } catch (error) {
//       // if error console the response and return the internal server error
//       console.error("Error updating order:", error.message)
//       res.status(500).json({ message: "Internal Server Error" })
//    }
// }

// get individual details
const getIndividualDetails = async (req, res) => {
   try {
      // take uuid in params
      const { uuid } = req.params

      // if uuid is not presemt
      if (!uuid) {
         return res.status(400).json({ message: "UUID is required!" })
      }

      // IMPORTANT: use await and .lean() to avoid circular references
      const order = await Job.findOne({ uuid }).lean()

      // order not found
      if (!order) {
         return res.status(404).json({ message: "Order not found!" })
      }

      // Send a plain JS object
      return res.status(200).json(order)
   } catch (error) {
      // if error console the response and return the internal server error
      console.error("Error fetching individual order:", error)
      return res.status(500).json({ message: "Internal server error" })
   }
}

// function to update the designer details
// const addOrUpdateDesignerDetails = async (req, res) => {
//    try {
//       // uuid pass as params
//       const { uuid } = req.params

//       // pass params body
//       const { invoiceNumber, draftDate, proceedDate,
//          designImages, draft_source, proceed_multiple_items, filePath,
//          production, production_departments, extra_instruction
//       } = req.body

//       // if uuid and invoice number not present
//       if (!uuid || !invoiceNumber) {
//          return res.status(400).json({ message: "All required field must be filled!" })
//       }

//       // if production person not filled
//       // if (!production) {
//       //    return res.status(400).json({ message: "Production person must be provided!" })
//       // }

//       // check if order exist by uuid
//       const existingJob = await Job.findOne({ uuid })
//       // if job is not exists
//       if (!existingJob) {
//          return res.status(404).json({ message: "Order not found!" })
//       }

//       if (draftDate) {
//          existingJob.draftDate = draftDate
//       }
//       if (proceedDate) {
//          existingJob.proceedDate = proceedDate
//       }
//       if (proceed_multiple_items) {
//          existingJob.proceed_multiple_items = proceed_multiple_items
//       }
//       if (draft_source) {
//          existingJob.draft_source = draft_source
//       }
//       if (filePath) {
//          existingJob.filePath = filePath
//       }
//       if (production_departments) {
//          existingJob.production_departments = production_departments
//       }
//       if (extra_instruction) {
//          existingJob.extra_instruction = extra_instruction
//       }

//       existingJob.assignToDepartment = "Production"
//       // existingJob.production = production

//       if (req.files && req.files.length > 0) {
//          const uploadedPaths = req.files.map(
//             file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
//          )
//          existingJob.designImages = uploadedPaths
//       }

//       // save the designer data
//       const updatedJob = await existingJob.save()

//       // return with response
//       res.status(200).json({
//          success: true,
//          message: "Designer details updated successfully!",
//          job: updatedJob
//       })
//    } catch (error) {
//       // if error console the response and return the internal server error
//       console.error("Error adding designer data:", error)
//       return res.status(500).json({ message: "Interval Server error" })
//    }
// }

// add or update production details
// const addOrUpdateProductionDetails = async (req, res) => {
//    try {
//       // uuid pass as params
//       const { uuid } = req.params

//       // pass params in body
//       const { recievedDate, size, quantity, media, printer,
//          completionDate, materialDetails, finishingDetails, finishing,
//          machine
//       } = req.body

//       // check if order exist by uuid
//       const existingJob = await Job.findOne({ uuid })
//       // if job is not exists
//       if (!existingJob) {
//          return res.status(404).json({ message: "Order not found!" })
//       }

//       if (recievedDate) {
//          existingJob.recievedDate = recievedDate
//       }
//       if (size) {
//          existingJob.size = size
//       }
//       if (quantity) {
//          existingJob.quantity = quantity
//       }
//       if (media) {
//          existingJob.media = media
//       }
//       if (printer) {
//          existingJob.printer = printer
//       }
//       if (completionDate) {
//          existingJob.completionDate = completionDate
//       }
//       if (materialDetails) {
//          existingJob.materialDetails = materialDetails
//       }
//       if (finishingDetails) {
//          existingJob.finishingDetails = finishingDetails
//       }
//       if (machine) {
//          existingJob.machine = machine
//       }

//       existingJob.assignToDepartment = "Finishing"
//       existingJob.finishing = finishing

//       // save the updated data
//       const updatedJob = await existingJob.save()

//       // return the response
//       res.status(200).json({
//          success: true,
//          message: "Production details updated successfully!",
//          job: updatedJob
//       })
//    } catch (error) {
//       // if error console the response and return the internal server error
//       console.error("Error updating production details:", error.message)
//       res.status(500).json({ message: "Internal Server Error" })
//    }
// }

// add or update finishing details
// const addOrUpdateFinishingDetails = async (req, res) => {
//    try {
//       // uuid pass as params
//       const { uuid } = req.params

//       // pass params in body
//       const { finishing, operation } = req.body

//       // check if order exist by uuid
//       const existingJob = await Job.findOne({ uuid })

//       // if job is not exists
//       if (!existingJob) {
//          return res.status(404).json({ message: "Order not found!" })
//       }

//       if (finishing) {
//          existingJob.finishing = finishing
//       }

//       existingJob.assignToDepartment = "Operation"
//       existingJob.operation = operation

//       // save the updated data
//       const updatedJob = await existingJob.save()

//       // return the response
//       res.status(200).json({
//          success: true,
//          message: "Finishing details updated successfully!",
//          job: updatedJob
//       })

//    } catch (error) {
//       // if error console the response and return the internal server error
//       console.error("Error updating finishing details:", error.message)
//       res.status(500).json({ message: "Internal Server Error" })
//    }
// }

// add or update operation details
// const addOrUpdateOperationDetails = async (req, res) => {
//    try {
//       // take uuid in params
//       const { uuid } = req.params

//       // body params
//       const { operationDate, operationTime, operationArea, team,
//          productionDetails, remarks, packagingInstruction, payment_status, isOperationCompleted
//       } = req.body

//       // check order is found by id or not
//       const existingJob = await Job.findOne({ uuid })

//       // if order is not present
//       if (!existingJob) {
//          return res.status(404).json({
//             message: "Order not found!"
//          })
//       }

//       if (operationDate) {
//          existingJob.operationDate = operationDate
//       }
//       if (operationTime) {
//          existingJob.operationTime = operationTime
//       }
//       if (operationArea) {
//          existingJob.operationArea = operationArea
//       }
//       if (team) {
//          existingJob.team = team
//       }
//       if (productionDetails) {
//          existingJob.productionDetails = productionDetails
//       }
//       if (remarks) {
//          existingJob.remarks = remarks
//       }
//       if (packagingInstruction) {
//          existingJob.packagingInstruction = packagingInstruction
//       }
//       if (payment_status) {
//          existingJob.payment_status = payment_status
//       }
//       if (typeof isOperationCompleted === "boolean") {
//          existingJob.isOperationCompleted = isOperationCompleted
//       }

//       // save the updated data
//       const updatedJob = await existingJob.save()

//       // return the response
//       res.status(200).json({
//          success: true,
//          message: "Operation details updated successfully!",
//          job: updatedJob
//       })
//    } catch (error) {
//       // if error console the response and return the internal server error
//       console.error("Error updating operation details:", error.message)
//       res.status(500).json({
//          message: "Internal Server Error"
//       })
//    }
// }

// delete the order
// const deleteOrder = async (req, res) => {
//    try {
//       const { uuid } = req.params

//       const order = await Job.findOneAndDelete({ uuid })

//       if (!order) {
//          return res.status(404).json({ message: "Order Not Found!" })
//       }

//       res.status(200).json({
//          message: "Order deleted successfully!",
//          deletedId: uuid
//       })
//    } catch (error) {
//       console.error("Error Deleting the order!", error)
//       res.status(500).json({ message: "Internal Server Error!" })
//    }
// }

const createNewQuote = async (req, res) => {
   try {
      const {
         createdBy, quote_uuid, quoteNumber, emirates, quoteDate, main_category, source,
         companyName, contactPerson, mobileNumber, emailId, item, category, description,
         division, billingAddress, deliveryAddress, type, salesPerson, amount,
         currencyType, status, dealStatus, multipleItems, assignToDepartment
      } = req.body

      // FIXED VALIDATION
      if (
         !createdBy ||
         !quote_uuid ||
         !quoteNumber ||
         !quoteDate ||
         !emirates ||
         !main_category ||
         !source ||
         !companyName ||
         !contactPerson ||
         !mobileNumber ||
         !emailId ||
         !description ||
         !item ||
         !category ||
         !division ||
         !billingAddress ||
         !deliveryAddress ||
         !type ||
         !salesPerson ||
         !amount ||
         !currencyType ||
         !status ||
         !dealStatus
      ) {
         return res.status(400).json({ message: "All required fields must be filled!" })
      }


      const existinguuid = await Quote.findOne({ quote_uuid })
      if (existinguuid) {
         return res.status(400).json({ message: "The Quote is Already Created!" })
      }

      const newQuote = new Quote({
         createdBy,
         quote_uuid,
         quoteNumber,
         quoteDate,
         emirates,
         main_category,
         source,
         companyName,
         contactPerson,
         mobileNumber,
         emailId,
         item,
         category,
         description,
         division,
         billingAddress,
         deliveryAddress,
         type,
         salesPerson,
         amount,
         currencyType,
         status,
         dealStatus,
         multipleItems,
         assignToDepartment
      })

      const savedQuote = await newQuote.save()

      res.status(200).json({
         success: true,
         message: "Quote Created Successfully!",
         quote: savedQuote
      })
   } catch (error) {
      console.error("Error creating new quote:", error)
      res.status(500).json({ message: "Internal Server Error" })
   }
}

const getAllSalesQuotes = async (req, res) => {
   try {
      const { page = 1, limit = 10, search = "", main_category, department, salesPerson, userName, userRole } = req.query

      const pipeline = []
      pipeline.push({ $match: { moveToInvoice: false } })
      if (search) {
         if (!isNaN(search)) {
            pipeline.push({
               $match: {
                  $expr: {
                     $regexMatch: {
                        input: { $toString: "$quoteNumber" },
                        regex: search,
                        options: "i"
                     }
                  }
               }
            })
         }
         else {
            pipeline.push({
               $match: {
                  $or: [
                     { contactPerson: { $regex: search, $options: "i" } },
                     { emailId: { $regex: search, $options: "i" } }
                  ]
               }
            })
         }
      }

      if (main_category) pipeline.push({ $match: { main_category } })
      if (department) pipeline.push({ $match: { division: department } })
      if (salesPerson) pipeline.push({ $match: { salesPerson } })

      // if (userRole && userName) {
      //    const name = new RegExp(`^${userName}$`, "i")

      //    if (userRole === "sales") {
      //       pipeline.push({ $match: { salesPerson: name } })
      //    }

      //    if (userRole === "design") {
      //       pipeline.push({ $match: { designer: name } })
      //    }
      // }

      if (userRole && req.query.access) {
         let accessArray = []

         try {
            accessArray = JSON.parse(req.query.access)
         } catch (e) {
            accessArray = [req.query.access]
         }

         const accessRegex = accessArray.map(name => new RegExp(`^${name}$`, "i"))

         if (userRole === "sales") {
            pipeline.push({
               $match: {
                  salesPerson: { $in: accessRegex }
               }
            })
         }

         if (userRole === "design") {
            const isSakib = userName && userName.toLowerCase() === "sakib"

            pipeline.push({
               $match: {
                  designer: { $exists: true, $ne: null }
               }
            })

            if (!isSakib) {
               pipeline.push({
                  $match: {
                     designer: { $in: accessRegex }
                  }
               })
            }
         }
      }

      pipeline.push({ $sort: { createdAt: -1 } })
      pipeline.push({ $skip: (page - 1) * parseInt(limit) })
      pipeline.push({ $limit: parseInt(limit) })
      const quotes = await Quote.aggregate(pipeline)

      const countPipeline = pipeline.filter(stage => !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage))
      countPipeline.push({ $count: "total" })

      const countResult = await Quote.aggregate(countPipeline)
      const total = countResult.length > 0 ? countResult[0].total : 0

      res.status(200).json({
         success: true,
         message: "Quotes Data!",
         data: quotes,
         total,
         page: parseInt(page),
         pages: Math.ceil(total / limit)
      })
   } catch (error) {
      console.error('Error getting quotes:', error.message)
      res.status(500).json({ message: "Internal Server Error" })
   }
}

// from our db
const getQuoteIndividualDetails = async (req, res) => {
   try {
      const { quote_uuid } = req.params

      if (!quote_uuid) {
         return res.status(400).json({ message: "UUID is required!" })
      }

      const quote = await Quote.findOne({ quote_uuid }).lean()

      if (!quote) {
         return res.status(404).json({ message: "Quote not found!" })
      }

      return res.status(200).json(quote)
   } catch (error) {
      console.error("Error fetching individual quote:", error)
      return res.status(500).json({ message: "Internal server error" })
   }
}

const updateSalesQuoteData = async (req, res) => {
   try {
      const { quote_uuid } = req.params

      const { quoteNumber, deliveryAddress, billingAddress, moveToInvoice, invoiceNumber, invoiceDate } = req.body

      if (!quote_uuid || !quoteNumber) {
         return res.status(400).json({ message: "All requires fields must be filled!" })
      }

      const existingQuote = await Quote.findOne({ quote_uuid })

      if (!existingQuote) {
         return res.status(404).json({ message: "Quote not found!" })
      }

      existingQuote.billingAddress = billingAddress || existingQuote.billingAddress
      existingQuote.deliveryAddress = deliveryAddress || existingQuote.deliveryAddress
      existingQuote.moveToInvoice = moveToInvoice ?? existingQuote.moveToInvoice
      existingQuote.invoiceNumber = invoiceNumber ?? existingQuote.invoiceNumber
      existingQuote.invoiceDate = invoiceDate ?? existingQuote.invalidate

      const updateQuote = await existingQuote.save()

      res.status(200).json({
         success: true,
         message: "Quote updated successfully!",
         quote: updateQuote
      })
   } catch (error) {
      console.error("Error updating quote", error.message)
      res.status(500).json({ message: "UUID is required!" })
   }
}

const getAllOrders = async (req, res) => {
   try {
      const { page = 1, limit = 10, search = "", main_category, department, salesPerson, orderStatus, designer, production, finishing, operation, userRole, userName } = req.query

      const pipeline = []
      pipeline.push({ $match: { moveToInvoice: true } })
      if (search) {
         if (!isNaN(search)) {
            pipeline.push({
               $match: {
                  $expr: {
                     $regexMatch: {
                        input: { $toString: "$quoteNumber" },
                        regex: search,
                        options: "i"
                     }
                  }
               }
            })
         }
         else {
            pipeline.push({
               $match: {
                  $or: [
                     { contactPerson: { $regex: search, $options: "i" } },
                     { emailId: { $regex: search, $options: "i" } }
                  ]
               }
            })
         }
      }

      if (main_category) pipeline.push({ $match: { main_category } })

      if (department) pipeline.push({ $match: { division: department } })

      if (salesPerson) pipeline.push({ $match: { salesPerson } })

      if (orderStatus) {
         if (['Designer', 'Production', 'Finishing'].includes(orderStatus)) {
            pipeline.push({ $match: { assignToDepartment: orderStatus } })
         } else if (orderStatus === 'Operation') {
            pipeline.push({
               $match: {
                  assignToDepartment: 'Operation',
                  isOperationCompleted: { $ne: true }
               }
            })
         } else if (orderStatus === 'Completed') {
            pipeline.push({
               $match: { isOperationCompleted: true }
            })
         }
      }

      if (designer) pipeline.push({ $match: { designer } })
      if (production) pipeline.push({ $match: { production } })
      if (finishing) pipeline.push({ $match: { finishing } })
      if (operation) pipeline.push({ $match: { operation } })

      // ✅ ROLE BASED FILTERING (IMPORTANT)
      // if (userRole && userName) {
      //    const name = new RegExp(`^${userName}$`, "i")

      //    if (userRole === "sales") {
      //       pipeline.push({ $match: { salesPerson: name } })
      //    }

      //    if (userRole === "design") {
      //       pipeline.push({ $match: { designer: name } })
      //    }

      //    if (userRole === "production") {
      //       pipeline.push({ $match: { production: name } })
      //    }

      //    if (userRole === "finishing") {
      //       pipeline.push({ $match: { finishing: name } })
      //    }

      //    if (userRole === "operation") {
      //       pipeline.push({ $match: { operation: name } })
      //    }
      // }

      if (userRole && req.query.access) {
         let accessArray = []

         try {
            accessArray = JSON.parse(req.query.access)
         } catch (e) {
            accessArray = [req.query.access]
         }

         const accessRegex = accessArray.map(name => new RegExp(`^${name}$`, "i"))
         if (userRole === "sales") {
            pipeline.push({
               $match: {
                  salesPerson: { $in: accessRegex }
               }
            })
         }

         if (userRole === "design") {
            const isSakib = userName && userName.toLowerCase() === "sakib"

            pipeline.push({
               $match: {
                  designer: { $exists: true, $ne: null }
               },
            })
            if (!isSakib) {
               pipeline.push({
                  $match: {
                     designer: { $in: accessRegex }
                  }
               })
            }
         }

         if (userRole === "production") {
            pipeline.push({
               $match: {
                  production_departments: {
                     $exists: true,
                     $ne: null,
                     $not: { $size: 0 } // works for arrays
                  }
               }
            })
         }

         if (userRole === "finishing") {
            pipeline.push({
               $match: {
                  finishing: { $in: accessRegex }
               }
            })
         }

         if (userRole === "operation") {
            pipeline.push({
               $match: {
                  operation: { $in: accessRegex }
               }
            })
         }
      }

      pipeline.push({ $sort: { createdAt: -1 } })
      pipeline.push({ $skip: (page - 1) * parseInt(limit) })
      pipeline.push({ $limit: parseInt(limit) })

      const orders = await Quote.aggregate(pipeline)
      const countPipeline = pipeline.filter(stage => !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage))
      countPipeline.push({ $count: "total" })

      const countResult = await Quote.aggregate(countPipeline)
      const total = countResult.length > 0 ? countResult[0].total : 0

      res.status(200).json({
         success: true,
         messag: "Orders Data!",
         data: orders,
         total,
         page: parseInt(page),
         pages: Math.ceil(total / limit)
      })
   } catch (error) {
      console.error('Error geting quotes:', error.message)
      res.status(500).json({ message: "Internal Server Error" })
   }
}

const updateSalesData = async (req, res) => {
   try {
      const { quote_uuid } = req.params

      const { invoiceNumber, invoiceDate, quoteNumber, deliveryAddress, billingAddress, modes,
         paymentStatus, assignToDepartment, designer, designers, production, finishing, operation, multipleItems,
         description, instruction, deliveryDate, deliveryTime, finishingInstruction
      } = req.body

      if (!quote_uuid || !quoteNumber) {
         return res.status(400).json({ message: "All required fields must be filled!" })
      }

      const existingOrder = await Quote.findOne({ quote_uuid })

      if (!existingOrder) {
         return res.status(404).json({ message: "Order not found!" })
      }

      const status = existingOrder.status?.toLowerCase().trim()

      if (status === "accepted" && !invoiceNumber) {
         return res.status(400).json({
            message: "Invoice Number is required when status is Aceepted!"
         })
      }

      if (invoiceNumber) {
         existingOrder.invoiceNumber = invoiceNumber
      }
      existingOrder.invoiceDate = invoiceDate || existingOrder.invoiceDate
      existingOrder.deliveryAddress = deliveryAddress || existingOrder.deliveryAddress
      existingOrder.billingAddress = billingAddress || existingOrder.billingAddress
      existingOrder.paymentStatus = paymentStatus || existingOrder.paymentStatus
      existingOrder.assignToDepartment = assignToDepartment || existingOrder.assignToDepartment
      existingOrder.modes = modes || existingOrder.modes

      // if (assignToDepartment === 'Designer' && designer) {
      //    existingOrder.designer = designer
      // }

      if (assignToDepartment === 'Designer') {
         if (Array.isArray(designers) && designers.length > 0) {
            existingOrder.designers = designers
            existingOrder.designer = designers[0]   // ✅ primary
         } else if (designer) {
            existingOrder.designer = designer
            existingOrder.designers = [designer]
         } else {
            // optional: clear if nothing selected
            existingOrder.designer = ""
            existingOrder.designers = []
         }
      }

      if (assignToDepartment === 'Production' && production) {
         existingOrder.production = production
      }

      if (assignToDepartment === 'Finishing' && finishing) {
         existingOrder.finishing = finishing
      }

      if (assignToDepartment === 'Operation' && operation) {
         existingOrder.operation = operation
      }

      existingOrder.multipleItems = multipleItems || existingOrder.multipleItems
      existingOrder.description = description || existingOrder.description
      existingOrder.instruction = instruction || existingOrder.instruction
      existingOrder.deliveryDate = deliveryDate || existingOrder.deliveryDate
      existingOrder.deliveryTime = deliveryTime || existingOrder.deliveryTime
      existingOrder.finishingInstruction = finishingInstruction || existingOrder.finishingInstruction

      const updatedOrder = await existingOrder.save()

      res.status(200).json({
         success: true,
         message: "Order update successfully!",
         order: updatedOrder
      })

   } catch (error) {
      console.error("Error updating order:", error.message)
      res.status(500).json({ message: "Internal Server Error" })
   }
}

const addOrUpdateDesignerDetails = async (req, res) => {
   try {
      // uuid pass as params
      const { quote_uuid } = req.params

      // pass params body
      const { invoiceNumber, quoteNumber, draftDate, proceedDate,
         designImages, draftSource, production_departments, filePath,
         proceedMultipleItems, extraInstruction, designer, designers
      } = req.body

      // if uuid and invoice number not present
      if (!quote_uuid || !quoteNumber) {
         return res.status(400).json({ message: "All required field must be filled!" })
      }

      // if production person not filled
      // if (!production) {
      //    return res.status(400).json({ message: "Production person must be provided!" })
      // }

      // check if order exist by uuid
      const existingOrder = await Quote.findOne({ quote_uuid })
      // if job is not exists
      if (!existingOrder) {
         return res.status(404).json({ message: "Order not found!" })
      }

      const status = existingOrder.status?.toLowerCase().trim()

      if (status === "accepted" && !invoiceNumber) {
         return res.status(400).json({
            message: "Invoice Number is required when status is Accepted!"
         })
      }

      // Designer update restriction
      // 🔽 ADD HERE
      let parsedDesigners = designers;

      try {
         parsedDesigners = typeof designers === "string"
            ? JSON.parse(designers)
            : designers;
      } catch (err) {
         parsedDesigners = [];
      }

      // 🔐 Restrict update
      if (designer !== undefined) {
         existingOrder.designer = designer;
      }

      if (parsedDesigners !== undefined) {
         existingOrder.designers = Array.isArray(parsedDesigners)
            ? parsedDesigners
            : [parsedDesigners];
      }


      if (invoiceNumber) {
         existingOrder.invoiceNumber = invoiceNumber
      }

      if (draftDate) {
         existingOrder.draftDate = draftDate
      }
      if (proceedDate) {
         existingOrder.proceedDate = proceedDate
      }
      if (proceedMultipleItems) {
         existingOrder.proceedMultipleItems = proceedMultipleItems
      }
      if (draftSource) {
         existingOrder.draftSource = draftSource
      }
      if (filePath) {
         existingOrder.filePath = filePath
      }
      if (production_departments) {
         existingOrder.production_departments = Array.isArray(production_departments)
            ? production_departments
            : [production_departments]
      }
      if (extraInstruction) {
         existingOrder.extraInstruction = extraInstruction
      }

      existingOrder.assignToDepartment = "Production"
      // existingJob.production = production

      if (req.files && req.files.length > 0) {
         const uploadedPaths = req.files.map(
            file => `${req.protocol}://${req.get('host')}/uploads/${file.filename}`
         )
         existingOrder.designImages = uploadedPaths
      }

      // save the designer data
      const updatedOrder = await existingOrder.save()

      // return with response
      res.status(200).json({
         success: true,
         message: "Designer details updated successfully!",
         order: updatedOrder
      })
   } catch (error) {
      // if error console the response and return the internal server error
      console.error("Error adding designer data:", error)
      return res.status(500).json({ message: "Interval Server error" })
   }
}

const addOrUpdateProductionDetails = async (req, res) => {
   try {
      // uuid pass as params
      const { quote_uuid } = req.params

      // pass params in body
      const { quoteNumber, invoiceNumber, recievedDate, size, quantity, media, printer,
         completionDate, materialDetails, finishingDetails, finishing,
         machine
      } = req.body

      if (!quote_uuid || !quoteNumber || !invoiceNumber) {
         return res.status(400).json({ message: "All required field must be filled!" })
      }

      // check if order exist by uuid
      const existingOrder = await Quote.findOne({ quote_uuid })
      // if job is not exists
      if (!existingOrder) {
         return res.status(404).json({ message: "Order not found!" })
      }

      if (recievedDate) {
         existingOrder.recievedDate = recievedDate
      }
      if (size) {
         existingOrder.size = size
      }
      if (quantity) {
         existingOrder.quantity = quantity
      }
      if (media) {
         existingOrder.media = media
      }
      if (printer) {
         existingOrder.printer = printer
      }
      if (completionDate) {
         existingOrder.completionDate = completionDate
      }
      if (materialDetails) {
         existingOrder.materialDetails = materialDetails
      }
      if (finishingDetails) {
         existingOrder.finishingDetails = finishingDetails
      }
      if (machine) {
         existingOrder.machine = machine
      }

      existingOrder.assignToDepartment = "Finishing"
      existingOrder.finishing = finishing

      // save the updated data
      const updatedJob = await existingOrder.save()

      // return the response
      res.status(200).json({
         success: true,
         message: "Production details updated successfully!",
         order: updatedJob
      })
   } catch (error) {
      // if error console the response and return the internal server error
      console.error("Error updating production details:", error.message)
      res.status(500).json({ message: "Internal Server Error" })
   }
}

const addOrUpdateFinishingDetails = async (req, res) => {
   try {
      // uuid pass as params
      const { quote_uuid } = req.params

      // pass params in body
      const { quoteNumber, invoiceNumber, finishing, operation, finishingRecieveDate, finishingCompletionDate } = req.body

      if (!quote_uuid || !quoteNumber || !invoiceNumber) {
         return res.status(400).json({ message: "All required field must be filled!" })
      }

      // check if order exist by uuid
      const existingOrder = await Quote.findOne({ quote_uuid })

      // if job is not exists
      if (!existingOrder) {
         return res.status(404).json({ message: "Order not found!" })
      }

      if (finishing) {
         existingOrder.finishing = finishing
      }
      if (finishingRecieveDate) {
         existingOrder.finishingRecieveDate = finishingRecieveDate
      }
      if (finishingCompletionDate) {
         existingOrder.finishingCompletionDate = finishingCompletionDate
      }

      existingOrder.assignToDepartment = "Operation"
      existingOrder.operation = operation

      // save the updated data
      const updatedJob = await existingOrder.save()

      // return the response
      res.status(200).json({
         success: true,
         message: "Finishing details updated successfully!",
         order: updatedJob
      })

   } catch (error) {
      // if error console the response and return the internal server error
      console.error("Error updating finishing details:", error.message)
      res.status(500).json({ message: "Internal Server Error" })
   }
}

const addOrUpdateOperationDetails = async (req, res) => {
   try {
      // take uuid in params
      const { quote_uuid } = req.params

      // body params
      const { quoteNumber, invoiceNumber, deliveryDate, deliveryTime, team,
         productionDetails, remarks, packagingInstruction, paymentStatus, isOperationCompleted
      } = req.body

      if (!quote_uuid || !quoteNumber || !invoiceNumber) {
         return res.status(400).json({ message: "All required field must be filled!" })
      }

      // check order is found by id or not
      const existingOrder = await Quote.findOne({ quote_uuid })

      // if order is not present
      if (!existingOrder) {
         return res.status(404).json({
            message: "Order not found!"
         })
      }

      if (deliveryDate) {
         existingOrder.deliveryDate = deliveryDate
      }
      if (deliveryTime) {
         existingOrder.deliveryTime = deliveryTime
      }
      if (team) {
         existingOrder.team = team
      }
      if (productionDetails) {
         existingOrder.productionDetails = productionDetails
      }
      if (remarks) {
         existingOrder.remarks = remarks
      }
      if (packagingInstruction) {
         existingOrder.packagingInstruction = packagingInstruction
      }
      if (paymentStatus) {
         existingOrder.paymentStatus = paymentStatus
      }
      if (typeof isOperationCompleted === "boolean") {
         existingOrder.isOperationCompleted = isOperationCompleted
      }

      // save the updated data
      const updatedOrder = await existingOrder.save()

      // return the response
      res.status(200).json({
         success: true,
         message: "Operation details updated successfully!",
         order: updatedOrder
      })
   } catch (error) {
      // if error console the response and return the internal server error
      console.error("Error updating operation details:", error.message)
      res.status(500).json({
         message: "Internal Server Error"
      })
   }
}

const getAllQuoteIds = async (req, res) => {
   try {
      const ids = await Quote.distinct("quoteNumber")
      return res.status(200).json({ success: true, ids })
   } catch (error) {
      console.error('Error in getAllQuoteIds:', error)
      return res.status(500).json({ success: false, message: 'Internal Server Error' })
   }
}

const deleteOrder = async (req, res) => {
   try {
      const { quote_uuid } = req.params

      const order = await Quote.findOneAndDelete({ quote_uuid })

      if (!order) {
         return res.status(404).json({ message: "Order Not Found!" })
      }

      res.status(200).json({
         message: "Order deleted successfully!",
         deletedId: quote_uuid
      })
   } catch (error) {
      console.error("Error Deleting the order!", error)
      res.status(500).json({ message: "Internal Server Error!" })
   }
}

module.exports = { createNewOrder, getAllOrders, updateSalesData, getIndividualDetails, addOrUpdateDesignerDetails, addOrUpdateProductionDetails, addOrUpdateFinishingDetails, addOrUpdateOperationDetails, deleteOrder, createNewQuote, getAllSalesQuotes, getQuoteIndividualDetails, updateSalesQuoteData, getAllQuoteIds }